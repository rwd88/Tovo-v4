// /pages/api/markets/active.ts
import { prisma } from "@/lib/prisma";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const markets = await prisma.market.findMany({
      where: { resolved: false },
    });

    // Convert `eventTime: Date` to string to avoid serialization errors
    const safeMarkets = markets.map((m) => ({
      ...m,
      eventTime: m.eventTime.toISOString(),
    }));

    res.status(200).json(safeMarkets);
  } catch (error) {
    console.error("[/api/markets/active] error:", error);
    res.status(500).json({ error: "Internal server error", markets: [] }); // <-- fallback
  }
}
