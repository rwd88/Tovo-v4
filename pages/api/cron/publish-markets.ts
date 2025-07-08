// pages/api/cron/publish-markets.ts
import type { NextApiRequest, NextApiResponse } from "next"
import { prisma } from "../../../lib/prisma"
import { sendMarketToTelegram } from "../../../lib/telegram/sendMarket"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const openMarkets = await prisma.market.findMany({
      where: { status: "open", published: false },
      orderBy: { createdAt: "desc" },
    })

    const results = []

    for (const market of openMarkets) {
      const response = await sendMarketToTelegram(market)
      if (response.ok) {
        await prisma.market.update({
          where: { id: market.id },
          data: { published: true },
        })
        results.push({ id: market.id, sent: true })
      } else {
        results.push({ id: market.id, sent: false, error: response.description })
      }
    }

    return res.status(200).json({ success: true, results })
  } catch (err: any) {
  console.error("publish-markets error:", err)
  return res.status(500).json({ success: false, error: err.message })
}
}
