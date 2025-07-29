import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { sendTelegramMessage } from '../../../lib/telegram'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: boolean; published: number; nextMarketId?: string }>
) {
  // 🔐 Authentication
  const token = req.query.secret || req.headers.authorization?.split(' ')[1] || ''
  if (token !== process.env.CRON_SECRET) {
    return res.status(403).json({ success: false, published: 0 })
  }

  try {
    // 1) Get the last published market ID from query params or DB
    const lastPublishedId = req.query.lastId as string || await getLastPublishedId()
    
    // 2) Get next market to publish (in rotation)
    const market = await getNextMarketToPublish(lastPublishedId)

    if (!market) {
      return res.status(200).json({ 
        success: true, 
        published: 0,
        nextMarketId: undefined // Reset rotation
      })
    }

    // 3) Format and send to Telegram
    await sendMarketToChannel(market)

    // 4) Update cron schedule to return next market ID
    return res.status(200).json({ 
      success: true, 
      published: 1,
      nextMarketId: market.id // For next execution
    })

  } catch (err) {
    console.error('Publish failed:', err)
    return res.status(500).json({ success: false, published: 0 })
  }
}

// Helper: Get next market in rotation
async function getNextMarketToPublish(lastId?: string) {
  const where = { 
    status: 'open',
    eventTime: { gt: new Date() }
  }

  const markets = await prisma.market.findMany({
    where,
    orderBy: { createdAt: 'asc' }
  })

  if (markets.length === 0) return null

  // Find next market after last published
  if (lastId) {
    const lastIndex = markets.findIndex(m => m.id === lastId)
    if (lastIndex >= 0 && lastIndex < markets.length - 1) {
      return markets[lastIndex + 1]
    }
  }

  // Return first market if none published or end reached
  return markets[0]
}

// Helper: Format and send message
async function sendMarketToChannel(market: any) {
  const message = `🎯 *New Prediction Market*\n\n` +
    `*${formatQuestion(market.question)}*\n` +
    `🕒 Expires: ${market.eventTime?.toUTCString()}\n` +
    `💰 Liquidity: $${(market.poolYes + market.poolNo).toFixed(2)}` +
    (market.forecast ? `\n📈 Forecast: ${market.forecast.toFixed(1)}% YES` : '')

  await sendTelegramMessage({
    chat_id: "-1002266469531",
    text: message,
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

  await prisma.market.update({
    where: { id: market.id },
    data: { lastPublishedAt: new Date() }
  })
}

// Helper: Format question naturally
function formatQuestion(question: string): string {
  // Add question mark if missing
  if (!question.trim().endsWith('?')) {
    return question + '?'
  }
  return question
}