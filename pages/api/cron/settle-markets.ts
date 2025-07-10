import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  try {
    const expiredMarkets = await prisma.market.findMany({
      where: {
        status: "open",
        eventTime: { lt: new Date() },
      },
      include: {
        trades: {
          select: {
            side: true,
            amount: true,
          },
        },
      },
    });

    const results = [];

    for (const market of expiredMarkets) {
      const yesPool = market.trades.filter(t => t.side === "yes").reduce((sum, t) => sum + t.amount, 0);
      const noPool = market.trades.filter(t => t.side === "no").reduce((sum, t) => sum + t.amount, 0);

      const outcome = yesPool > noPool ? "yes" : "no";

      await prisma.market.update({
        where: { id: market.id },
        data: {
          status: "settled",
          outcome,
          settledAt: new Date(),
        },
      });

      results.push({
        id: market.id,
        outcome,
        yesPool,
        noPool,
      });
    }

    return res.status(200).json({ success: true, results });
  } catch (err: any) {
    console.error("❌ Error in settle-markets:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
