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
  // 1️⃣ Authenticate
  const token =
    (req.query.secret as string) ||
    req.headers.authorization?.replace('Bearer ', '') ||
    ''
  if (token !== process.env.CRON_SECRET) {
    await sendAdminAlert('⚠️ Unauthorized publish-markets call')
    return res.status(403).json({ success: false, published: 0 })
  }

  try {
    // 2️⃣ Find the *next* un-notified market
    const market = await prisma.market.findFirst({
      where: {
        status:    'open',
        notified:  false,
        eventTime: { gt: new Date() },
      },
      orderBy: { eventTime: 'asc' },
    })

    if (!market) {
      // nothing to send
      return res.status(200).json({ success: true, published: 0 })
    }

    // 3️⃣ Build the Telegram message
    const msg =
      formatMarketMessage(market) + '\n\n' +
      `[✅ YES](${process.env.BOT_WEB_URL}/trade/${market.id}?side=yes) ` +
      `[❌ NO](${process.env.BOT_WEB_URL}/trade/${market.id}?side=no)`

    // 4️⃣ Send to your public channel
    await sendTelegramMessage({
      chat_id:    process.env.TELEGRAM_CHANNEL_ID!,
      text:       msg,
      parse_mode: 'Markdown',
    })

    // 5️⃣ Mark it notified
    await prisma.market.update({
      where: { id: market.id },
      data:  { notified: true },
    })

    return res.status(200).json({
      success:   true,
      published: 1,
      id:        market.id,
    })
  } catch (err: any) {
    console.error('publish-markets error:', err)
    await sendAdminAlert(`❌ publish-markets failed: ${err.message}`)
    return res.status(500).json({ success: false, published: 0, error: err.message })
  }
}
