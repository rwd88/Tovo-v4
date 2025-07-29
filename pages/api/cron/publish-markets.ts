// pages/api/cron/publish-markets.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { sendTelegramMessage, sendAdminAlert } from '../../../lib/telegram'
import { formatMarketMessage } from '../../../lib/market-utils'

interface PublishResponse {
  success:   boolean
  published: number
  id?:       string
  error?:    string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PublishResponse>
) {
  // 1) Authenticate
  const token = (req.query.secret as string) ||
                req.headers.authorization?.replace('Bearer ', '') ||
                ''
  if (token !== process.env.CRON_SECRET) {
    await sendAdminAlert('⚠️ Unauthorized access to publish-markets')
    return res.status(403).json({ success: false, published: 0 })
  }

  try {
    // 2) Grab exactly one “next” market
    const market = await prisma.market.findFirst({
      where: { status: 'open', notified: false, eventTime: { gt: new Date() } },
      orderBy: { eventTime: 'asc' },
    })

    if (!market) {
      return res.status(200).json({ success: true, published: 0 })
    }

    // 3) Build and send the Telegram post
    const message =
      `📊 *New Prediction Market!*\n\n${formatMarketMessage(market)}\n\n` +
      `[✅ YES](${process.env.BOT_WEB_URL}/trade/${market.id}?side=yes) ` +
      `[❌ NO](${process.env.BOT_WEB_URL}/trade/${market.id}?side=no)\n` +
      `[🔍 View Market](${process.env.BOT_WEB_URL}/markets/${market.id})`

    await sendTelegramMessage({
      chat_id: process.env.TELEGRAM_CHANNEL_ID!,
      text: message,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    })

    // 4) Mark it as sent
    await prisma.market.update({
      where: { id: market.id },
      data:  { notified: true },
    })

    return res.status(200).json({ success: true, published: 1, id: market.id })
  } catch (err: any) {
    console.error('publish-markets error:', err)
    await sendAdminAlert(`❌ publish-markets crashed: ${err.message}`)
    return res.status(500).json({ success: false, published: 0, error: err.message })
  }
}
