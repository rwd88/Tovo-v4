import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { sendTelegramMessage } from '../../../lib/telegram'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: boolean; published: number }>
) {
  // 🔐 Authentication
  const token = req.query.secret || req.headers.authorization?.split(' ')[1] || ''
  if (token !== process.env.CRON_SECRET) {
    return res.status(403).json({ success: false, published: 0 })
  }

  try {
    // 1) Get unpublished markets
    const markets = await prisma.market.findMany({
      where: { 
        status: 'open',
        notified: false,
        eventTime: { gt: new Date() }
      },
      orderBy: { eventTime: 'asc' },
      take: 10 // Prevent rate limiting
    })

    let published = 0

    // 2) Send to Telegram channel
    for (const market of markets) {
      try {
        await sendTelegramMessage({
          chat_id: "-1002266469531", // Your channel ID
          text: `🎯 *New Prediction Market*\n\n` +
                `*${market.question}*\n` +
                `🕒 ${market.eventTime?.toUTCString()}\n` +
                `💰 Pool: $${(market.poolYes + market.poolNo).toFixed(2)}` +
                (market.forecast ? `\n📈 Forecast: ${market.forecast.toFixed(1)}% YES` : ''),
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { 
                  text: "✅ Trade YES", 
                  url: `${process.env.NEXT_PUBLIC_SITE_URL}/trade/${market.id}?side=yes` 
                },
                { 
                  text: "❌ Trade NO", 
                  url: `${process.env.NEXT_PUBLIC_SITE_URL}/trade/${market.id}?side=no` 
                }
              ]
            ]
          }
        })

        // Mark as published
        await prisma.market.update({
          where: { id: market.id },
          data: { notified: true }
        })

        published++
      } catch (err) {
        console.error(`Market ${market.id} failed:`, err)
      }
    }

    return res.status(200).json({ success: true, published })

  } catch (err) {
    console.error('Publish failed:', err)
    return res.status(500).json({ success: false, published: 0 })
  }
}