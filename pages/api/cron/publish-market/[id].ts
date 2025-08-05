// pages/api/cron/publish-market/[id].ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { sendTelegramMessage, sendAdminAlert } from '@/lib/telegram'
import { formatMarketHtml } from '@/lib/market-utils'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: boolean; error?: string }>
) {
  // 1) Authenticate
  const token =
    (req.query.secret as string) ||
    req.headers.authorization?.replace('Bearer ', '') ||
    ''
  if (token !== process.env.CRON_SECRET) {
    await sendAdminAlert('⚠️ Unauthorized publish-market/[id] call')
    return res.status(403).json({ success: false, error: 'Invalid secret' })
  }

  // 2) Load market
  const { id } = req.query as { id: string }
  const m = await prisma.market.findUnique({ where: { id } })
  if (!m) {
    await sendAdminAlert(`⚠️ publish-market: market ${id} not found`)
    return res.status(404).json({ success: false, error: 'Market not found' })
  }

  // 3) Build message
  const coreHtml = formatMarketHtml(m)
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || ''
  const yesUrl  = `${baseUrl}/trade/${m.id}?side=yes`
  const noUrl   = `${baseUrl}/trade/${m.id}?side=no`

  // 4) Send to Telegram with logging
  try {
    const payload = {
      chat_id: process.env.TELEGRAM_CHANNEL_ID!,
      text:    coreHtml,
      parse_mode: 'HTML' as const,
      disable_web_page_preview: true,
      reply_markup: JSON.stringify({
        inline_keyboard: [
          [{ text: '✅ YES', url: yesUrl }, { text: '❌ NO', url: noUrl }]
        ]
      })
    }

    console.log('Publishing market to Telegram, payload:', payload)
    const telegramRes = await sendTelegramMessage(payload)
    console.log('Telegram API response:', telegramRes)

    // 5) Mark notified
    await prisma.market.update({
      where: { id },
      data: { notified: true },
    })

    return res.status(200).json({ success: true })
  } catch (err: any) {
    console.error('❌ publish-market/[id] failed:', err)
    await sendAdminAlert(`❌ publish-market failed for ${id}: ${err.message}`)
    return res.status(500).json({ success: false, error: err.message })
  }
}
