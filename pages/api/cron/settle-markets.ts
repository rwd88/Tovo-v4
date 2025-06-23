// pages/api/cron/settle-markets.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { sendCronSummary, sendAdminAlert } from "../../../lib/telegram";

interface ApiResponse {
  success: boolean;
  totalSettled?: number;
  totalProfit?: number;
  error?: string;
}

export const config = {
  api: {
    // allow up to 60 seconds per invocation
    externalResolver: true,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // 1) AUTH
  const providedSecret =
    (req.query.secret as string) ||
    req.headers.authorization?.split("Bearer ")[1];

  if (process.env.CRON_SECRET == null) {
    console.error("⚠️  CRON_SECRET not set");
    return res
      .status(500)
      .json({ success: false, error: "Server misconfiguration" });
  }
  if (providedSecret !== process.env.CRON_SECRET) {
    console.warn("❌  Unauthorized settlement attempt");
    return res.status(403).json({ success: false, error: "Unauthorized" });
  }

  try {
    console.log("⏳  Starting market settlement…");
    const batchSize = 20;
    let skip = 0;
    let totalSettled = 0;
    let totalProfit = 0;

    while (true) {
      // 2) load a page of markets ready to settle
      const markets = await prisma.market.findMany({
        where: {
          eventTime: { lt: new Date() },
          status: "resolved",
        },
        include: { trades: true },
        orderBy: { eventTime: "asc" },
        skip,
        take: batchSize,
      });
      if (markets.length === 0) break;

      console.log(`→ Settling batch of ${markets.length} markets…`);
      // 3) process them in parallel
      const results = await Promise.allSettled(
        markets.map(async (m) => {
          // determine winning side
          const outcome = (m.outcome ?? "").toUpperCase();
          if (!["YES", "NO"].includes(outcome)) {
            // just mark as settled if outcome invalid
            await prisma.market.update({
              where: { id: m.id },
              data: { status: "settled" },
            });
            return 0;
          }

          // separate winning vs losing
          const winningPool = outcome === "YES" ? m.poolYes : m.poolNo;
          const totalPool = m.poolYes + m.poolNo;
          if (winningPool === 0) {
            // no winners → house keeps entire pool
            await prisma.market.update({
              where: { id: m.id },
              data: { status: "settled" },
            });
            return totalPool;
          }

          // fee: 1% total pool; houseCut: 10% of total pool
          const tradingFee = totalPool * 0.01;
          const houseCut = totalPool * 0.10;
          const netPool = totalPool - tradingFee - houseCut;
          const payoutPerShare = netPool / winningPool;

          // payoff each winning trade
          const winners = m.trades.filter(
            (t) => t.type.toUpperCase() === outcome
          );

          // batch winners in chunks
          const chunk = 50;
          for (let i = 0; i < winners.length; i += chunk) {
            const slice = winners.slice(i, i + chunk);
            await prisma.$transaction(
              slice.map((t) =>
                prisma.trade.update({
                  where: { id: t.id },
                  data: {
                    settled: true,
                    // credit user balance = stake * payoutPerShare
                    // (we assume you track balances on User model)
                    user: {
                      update: {
                        balance: {
                          increment: t.amount * payoutPerShare,
                        },
                      },
                    },
                  },
                })
              )
            );
          }

          // finally mark market settled
          await prisma.market.update({
            where: { id: m.id },
            data: { status: "settled" },
          });

          // return houseCut for reporting
          return houseCut + tradingFee;
        })
      );

      // collect results
      results.forEach((r) => {
        if (r.status === "fulfilled") {
          totalSettled++;
          totalProfit += r.value;
        } else {
          console.error("⚠️  Error settling one market:", r.reason);
        }
      });

      skip += markets.length;
    }

    console.log(`✅  Settled ${totalSettled} markets, profit $${totalProfit}`);
    await sendCronSummary(
      `🏦 Settlement done:\n• Markets: ${totalSettled}\n• House profit: $${totalProfit.toFixed(
        2
      )}`
    );
    return res
      .status(200)
      .json({ success: true, totalSettled, totalProfit });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    console.error("❌  Settlement failed:", err);
    await sendAdminAlert(`🚨 Settlement failure: ${msg}`);
    return res.status(500).json({ success: false, error: msg });
  }
}
