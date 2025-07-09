// pages/api/cron/settle-markets.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { settleMarket } from "../../../lib/settlement"; // assumed to exist

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const expiredMarkets = await prisma.market.findMany({
      where: {
        status: "open",
        expiresAt: { lte: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    const results = [];

    for (const market of expiredMarkets) {
      try {
        const settlement = await settleMarket(market.id);
        results.push({ id: market.id, settled: true, outcome: settlement });
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