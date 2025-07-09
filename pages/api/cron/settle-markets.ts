// pages/api/cron/settle-markets.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { settleMarket } from "../../../lib/settlement";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end("Method Not Allowed");
  }

  try {
    // 1. Get all expired markets (status = open, eventTime < now)
    const expiredMarkets = await prisma.market.findMany({
      where: {
        status: "open",
        eventTime: {
          lt: new Date(),
        },
      },
    });

    const results = [];

    for (const market of expiredMarkets) {
      try {
        // 2. Run settlement logic
        const winningOutcome = await settleMarket(market.id);

        // 3. Update market as settled
        await prisma.market.update({
          where: { id: market.id },
          data: {
            status: "settled",
outcome: winningOutcome,
          },
        });

        results.push({ id: market.id, settled: true, outcome: winningOutcome.name });
      } catch (err: any) {
        results.push({ id: market.id, settled: false, error: err.message });
      }
    }

    return res.status(200).json({ success: true, results });
  } catch (err: any) {
    console.error("Settle markets error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
