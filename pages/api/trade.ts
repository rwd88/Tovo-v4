// pages/api/trade.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../lib/prisma";
import { sendAdminAlert } from "../../lib/telegram";

type TradeSide = "YES" | "NO";

interface TradeResponse {
  success: boolean;
  newPoolYes?: number;
  newPoolNo?: number;
  userBalance?: number;
  error?: string;
}

function bad(res: NextApiResponse<TradeResponse>, msg: string, code = 400) {
  return res.status(code).json({ success: false, error: msg });
}

const mask = (addr = "") =>
  addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TradeResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return bad(res, "Only POST allowed", 405);
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const marketId = String(body?.marketId || "").trim();
    const walletAddressRaw = String(body?.walletAddress || "").trim();
    const side = String(body?.side || "").toUpperCase() as TradeSide;
    const amount = Number(body?.amount);

    if (!marketId) return bad(res, "Missing marketId");
    if (!walletAddressRaw) return bad(res, "Missing walletAddress");
    const walletAddress = walletAddressRaw.toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(walletAddress)) {
      return bad(res, "Invalid walletAddress format");
    }
    if (side !== "YES" && side !== "NO")
      return bad(res, "Side must be YES or NO");
    if (!Number.isFinite(amount) || amount <= 0)
      return bad(res, "Amount must be a positive number");

    // Validate market
    const market = await prisma.market.findUnique({
      where: { id: marketId },
      select: {
        id: true,
        question: true,
        status: true,
        eventTime: true,
        resolvedOutcome: true,
      },
    });
    if (!market) return bad(res, "Market not found", 404);
    if (market.status.toLowerCase() !== "open")
      return bad(res, "Market is not open");
    if (market.resolvedOutcome) return bad(res, "Market already resolved");
    if (new Date(market.eventTime).getTime() <= Date.now())
      return bad(res, "Market already closed");

    // ---- Fee Logic ----
    const TRADE_FEE_BPS = Number(process.env.FEE_BPS ?? 100); // 1% per trade
    const tradeFee = Math.max(0, (amount * TRADE_FEE_BPS) / 10_000);
    const totalDebit = amount + tradeFee;

    // ---- Transaction ----
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { walletAddress },
        update: {},
        create: { walletAddress, balance: 0 },
        select: { id: true, balance: true },
      });

      if (user.balance < totalDebit) throw new Error("Insufficient balance");

      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: { balance: { decrement: totalDebit } },
        select: { balance: true },
      });

      const updatedMarket = await tx.market.update({
        where: { id: marketId },
        data:
          side === "YES"
            ? {
                poolYes: { increment: amount },
                feeCollected: { increment: tradeFee },
              }
            : {
                poolNo: { increment: amount },
                feeCollected: { increment: tradeFee },
              },
        select: { poolYes: true, poolNo: true },
      });

      await tx.trade.create({
        data: {
          marketId,
          userId: user.id,
          type: side,
          amount,
          fee: tradeFee,
          settled: false,
        },
      });

      return {
        newPoolYes: updatedMarket.poolYes,
        newPoolNo: updatedMarket.poolNo,
        userBalance: updatedUser.balance,
        fee: tradeFee,
        totalDebit,
      };
    });

    // ---- Notify Admin ----
    try {
      await sendAdminAlert?.(
        [
          "🟢 New Trade",
          `• Market: ${market.id}`,
          market.question ? `• Q: ${market.question}` : null,
          `• Wallet: ${mask(walletAddress)}`,
          `• Side: ${side}`,
          `• Amount: ${amount.toFixed(2)}`,
          `• Fee (Admin): ${result.fee.toFixed(2)} (${TRADE_FEE_BPS} bps)`,
          `• Total debited: ${result.totalDebit.toFixed(2)}`,
          `• Pools → Yes: ${result.newPoolYes?.toFixed(
            2
          )} | No: ${result.newPoolNo?.toFixed(2)}`,
          `• When: ${new Date().toISOString()}`,
        ]
          .filter(Boolean)
          .join("\n")
      );
    } catch {}

    return res.status(200).json({
      success: true,
      newPoolYes: result.newPoolYes,
      newPoolNo: result.newPoolNo,
      userBalance: result.userBalance,
    });
  } catch (err: any) {
    const msg = err?.message || "Server error";
    if (
      msg.includes("Insufficient balance") ||
      msg.startsWith("Invalid walletAddress")
    ) {
      return bad(res, msg, 400);
    }
    console.error("[/api/trade] failed:", err);
    return bad(res, msg, 500);
  }
}
