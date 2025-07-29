import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { sendTelegramMessage } from '../../../lib/telegram'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: boolean; published: number }>
) {
  // 🔐 Authentication
  const token = req.query.secret as string || ''
  if (token !== '12345A') { // Hardcoded for security
    return res.status(403).json({ success: false, published: 0 })
  }

  try {
    // 1. Get the next market to publish using transaction
    const market = await prisma.$transaction(async (tx) => {
      // Find markets that need publishing
      const candidates = await tx.market.findMany({
        where: {
          status: 'open',
          eventTime: { gt: new Date() },
          OR: [
            { lastPublishedAt: null }, // Never published
            { 
              lastPublishedAt: { 
                lt: new Date(Date.now() - 6 * 60 * 60 * 1000) // 6-hour cooldown
              } 
            }
          ]
        },
        orderBy: [
          { lastPublishedAt: 'asc' }, // Oldest publish first
          { eventTime: 'asc' }        // Then earliest event
        ],
        take: 1
      })

      if (candidates.length === 0) return null

      // Update publish time
      await tx.market.update({
        where: { id: candidates[0].id },
        data: { lastPublishedAt: new Date() }
      })

      return candidates[0]
    })

    if (!market) {
      console.log('No markets available for publishing')
      return res.status(200).json({ success: true, published: 0 })
    }

    // 2. Format and send the message
    const formattedQuestion = market.question.endsWith('?') 
      ? market.question 
      : `${market.question}?`

    const message = `🎯 *New Prediction Market*\n\n` +
      `*${formattedQuestion}*\n` +
      `🕒 Expires: ${market.eventTime.toUTCString()}\n` +
      `💰 Liquidity: $${(market.poolYes + market.poolNo).toFixed(2)}` +
      (market.forecast ? `\n📈 Forecast: ${market.forecast.toFixed(1)}% YES` : '')

    await sendTelegramMessage({
      chat_id: "-1002266469531",
      text: message,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { 
            text: "✅ Trade YES", 
            url: `${process.env.NEXT_PUBLIC_SITE_URL}/trade/${market.id}?side=yes` 
          },
          { 
            text: "❌ Trade NO", 
            url: `${process.env.NEXT_PUBLIC_SITE_URL}/trade/${market.id}?side=no` 
          }
        ]]
      }
    })

    console.log(`Published market: ${market.question}`)
    return res.status(200).json({ success: true, published: 1 })

  } catch (err) {
    console.error('Publish failed:', err)
    return res.status(500).json({ success: false, published: 0 })
  }
}