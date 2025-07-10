import type { NextApiRequest, NextApiResponse } from "next"
import { prisma } from "../../../lib/prisma"
import bot from "../../../src/bot/bot"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.query.secret !== process.env.CRON_SECRET) {
    return res.status(403).json({ error: "Unauthorized" })
  }

  try {
    const expiredMarkets = await prisma.market.findMany({
      where: {
        status: "open",
        eventTime: { lt: new Date() }
      },
      include: {
        trades: true
      }
    })

    const settled = []

    for (const market of expiredMarkets) {
      const yesPool = market.trades.filter(t => t.side === "yes").reduce((sum, t) => sum + t.amount, 0)
      const noPool = market.trades.filter(t => t.side === "no").reduce((sum, t) => sum + t.amount, 0)

      const outcome = yesPool >= noPool ? "yes" : "no"
      const total = yesPool + noPool
      const forecast = total > 0 ? Math.round((yesPool / total) * 100) : 0

      // Update DB
      await prisma.market.update({
        where: { id: market.id },
        data: {
          status: "settled",
          outcome,
          settledAt: new Date()
        }
      })

      // Notify subscribers
      const message = `✅ *Market Settled!*\n\n*${market.question}*\n\n` +
        `🧾 Outcome: *${outcome.toUpperCase()}*\n` +
        `📊 Forecast was: ${forecast}% chance of YES\n` +
        `💰 Liquidity: $${total.toFixed(2)}`

      const subscribers = await prisma.subscriber.findMany({
        where: { subscribed: true }
      })

      for (const sub of subscribers) {
        try {
          await bot.telegram.sendMessage(sub.chatId, message, {
            parse_mode: "Markdown"
          })
        } catch (err: any) {
          console.error(`Failed to notify ${sub.chatId}:`, err.message)
        }
      }

      settled.push({
        id: market.id,
        question: market.question,
        outcome,
        yesPool,
        noPool,
        forecast,
        total
      })
    }

    return res.status(200).json({
      success: true,
      settled
    })
  } catch (err: any) {
    console.error("❌ Error in settle-markets:", err)
    return res.status(500).json({ error: err.message })
  }
}
