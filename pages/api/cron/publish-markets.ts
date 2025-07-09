import type { NextApiRequest, NextApiResponse } from "next"
import { prisma } from "../../../lib/prisma"
import bot from "../../../src/bot/bot"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(403).json({ error: "Unauthorized" })
  }

  try {
    const openMarkets = await prisma.market.findMany({
      where: {
        status: "open",
        published: false,
        question: { not: undefined } // ✅ FIXED: allow Prisma filter
      },
      orderBy: { eventTime: "asc" }
    })

    const subscribers = await prisma.subscriber.findMany({
      where: { subscribed: true }
    })

    console.log(`📢 Publishing ${openMarkets.length} markets to ${subscribers.length} subscribers`)

    const results = []
    const failedSends = []

    for (const market of openMarkets) {
      if (!market.question?.trim()) {
        console.error("Skipping market with empty question:", market.id)
        continue
      }

      const message = `📊 *New Prediction Market!*\n\n*${market.question}*` +
        (market.eventTime ? `\n⏰ ${new Date(market.eventTime).toLocaleString()}` : "") +
        `\n\nMake your prediction:`

      const buttons = {
        reply_markup: {
          inline_keyboard: [[
            {
              text: "✅ YES",
              url: `${process.env.BOT_WEB_URL}/trade/${market.id}?side=yes`
            },
            {
              text: "❌ NO",
              url: `${process.env.BOT_WEB_URL}/trade/${market.id}?side=no`
            }
          ]]
        },
        parse_mode: "Markdown" as const
      }

      let sentCount = 0
      let failedCount = 0

      for (const sub of subscribers) {
        try {
          await sendWithRetry(sub.chatId, message, buttons)
          sentCount++
        } catch (err: any) {
          console.error(`Failed to send to ${sub.chatId}:`, err.message)
          failedCount++
          failedSends.push({ chatId: sub.chatId, error: err.message })

          // Unsubscribe if user blocked bot
          if (err.description?.includes("blocked") || err.code === 403) {
            await prisma.subscriber.update({
              where: { chatId: sub.chatId },
              data: { subscribed: false }
            })
          }
        }
      }

      await prisma.market.update({
        where: { id: market.id },
        data: { published: true }
      })

      results.push({
        id: market.id,
        question: market.question,
        sentCount,
        failedCount
      })
    }

    return res.status(200).json({
      success: true,
      results,
      failedSends: failedSends.length > 0 ? failedSends : undefined
    })
  } catch (err: any) {
    console.error("❌ publish-markets error:", err)
    return res.status(500).json({
      success: false,
      error: err.message
    })
  }
}

async function sendWithRetry(chatId: string, message: string, buttons: any, retries = 2) {
  try {
    await bot.telegram.sendMessage(chatId, message, buttons)
  } catch (err) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      return sendWithRetry(chatId, message, buttons, retries - 1)
    }
    throw err
  }
}
