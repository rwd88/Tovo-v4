// pages/api/cron/publish-markets.ts
import type { NextApiRequest, NextApiResponse } from "next"
import { prisma } from "../../../lib/prisma"
import TelegramBot from "node-telegram-bot-api"

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: false })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const openMarkets = await prisma.market.findMany({
      where: { status: "open", published: false },
      orderBy: { createdAt: "desc" }
    })

    const subscribers = await prisma.subscriber.findMany()

    const results = []

    for (const market of openMarkets) {
      const message = `🧠 *New Prediction Market!*\n\n*${market.question}*\n\nChoose your prediction below 👇`

      const buttons = {
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ Buy YES", url: `https://tovo.link/trade/${market.id}?side=yes` },
            { text: "❌ Buy NO", url: `https://tovo.link/trade/${market.id}?side=no` }
          ]]
        },
        parse_mode: "Markdown"
      }

      for (const sub of subscribers) {
        try {
          await bot.sendMessage(sub.chatId, message, buttons)
        } catch (err) {
          console.error("Failed to send to subscriber", sub.chatId, err)
        }
      }

      // Mark as published
      await prisma.market.update({
        where: { id: market.id },
        data:  { published: true }
      })

      results.push({ id: market.id, sent: true })
    }

    return res.status(200).json({ success: true, results })
  } catch (err: any) {
    console.error("publish-markets error:", err)
    return res.status(500).json({ success: false, error: err.message })
  }
}
