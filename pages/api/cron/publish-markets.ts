// pages/api/cron/publish-markets.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import bot from '../../../src/bot/bot'

export type PublishResult = {
  id: string
  question: string
  sentCount: number
  failedCount: number
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    | { success: true; results: PublishResult[]; failedSends?: { chatId: string; error: string }[] }
    | { success: false; error: string }
  >
) {
  // 1) Authenticate via ?secret= or Authorization header
  const secretFromQuery = (req.query.secret as string) || ''
  const bearer = req.headers.authorization?.split(' ')[1] || ''
  const incomingSecret = secretFromQuery || bearer

  if (incomingSecret !== process.env.CRON_SECRET) {
    return res.status(403).json({ success: false, error: 'Unauthorized' })
  }

  try {
    // 2) Load all open, un-notified markets
    const openMarkets = await prisma.market.findMany({
      where: { status: 'open', notified: false, question: { not: undefined } },
      orderBy: { eventTime: 'asc' },
    })

    // 3) Load subscribers
    const subscribers = await prisma.subscriber.findMany({ where: { subscribed: true } })

    const results: PublishResult[] = []
    const failedSends: Array<{ chatId: string; error: string }> = []

    // 4) Send each market notification
    for (const market of openMarkets) {
      const { id, question, eventTime, poolYes, poolNo, forecast } = market
      if (!question.trim()) {
        console.warn(`Skipping empty question for market ${id}`)
        continue
      }

      // build the message + buttons
      const when = eventTime ? `\n🕓 ${new Date(eventTime).toUTCString()}` : ''
      const liquidity = (poolYes + poolNo).toFixed(2)
      const forecastText =
        forecast != null ? `\n📈 Forecast: ${forecast.toFixed(1)}% YES` : ''

      const message = `📊 *New Prediction Market!*\n\n*${question}*${when}\n💰 Liquidity: $${liquidity}${forecastText}\n\nMake your prediction:`
      const buttons = {
        parse_mode: 'Markdown' as const,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ YES', url: `${process.env.BOT_WEB_URL}/trade/${id}?side=yes` },
              { text: '❌ NO',  url: `${process.env.BOT_WEB_URL}/trade/${id}?side=no`  },
            ],
          ],
        },
      }

      let sentCount = 0
      let failedCount = 0

      for (const sub of subscribers) {
        try {
          await sendWithRetry(sub.chatId, message, buttons, 2)
          sentCount++
        } catch (err: any) {
          failedCount++
          const errorMsg = err.description || err.message || String(err)
          failedSends.push({ chatId: sub.chatId, error: errorMsg })
          console.error(`Failed to send market ${id} → ${sub.chatId}:`, errorMsg)

          // auto-unsubscribe if blocked (403 or “blocked” text)
          if (err.code === 403 || errorMsg.toLowerCase().includes('blocked')) {
            await prisma.subscriber.update({
              where: { chatId: sub.chatId },
              data: { subscribed: false },
            })
          }
        }
      }

      // 5) Mark market as notified so it won’t run again
      await prisma.market.update({
        where: { id },
        data: { notified: true },
      })

      results.push({ id, question, sentCount, failedCount })
    }

    return res.status(200).json({ success: true, results, failedSends: failedSends.length ? failedSends : undefined })
  } catch (err: any) {
    console.error('publish-markets error:', err)
    return res.status(500).json({ success: false, error: err.message })
  }
}

/**
 * sendWithRetry: wraps bot.telegram.sendMessage with retries and backoff
 */
async function sendWithRetry(
  chatId: string,
  message: string,
  buttons: any,
  retries: number
): Promise<void> {
  try {
    await bot.telegram.sendMessage(chatId, message, buttons)
  } catch (err: any) {
    if (retries > 0) {
      // wait 1s then retry
      await new Promise((r) => setTimeout(r, 1000))
      return sendWithRetry(chatId, message, buttons, retries - 1)
    }
    // rethrow if out of retries
    throw err
  }
}
