// pages/api/cron/publish-markets.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { sendTelegramMessage, sendAdminAlert } from '../../../lib/telegram'
import { escapeHtml, formatMarketHtml } from '../../lib/market-utils'

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
  // 🔐 Authenticate via ?secret= or Bearer header
  const token =
    (req.query.secret as string) ||
    req.headers.authorization?.replace('Bearer ', '') ||
    ''
  if (token !== process.env.CRON_SECRET) {
    await sendAdminAlert('⚠️ Unauthorized publish-markets call')
    return res.status(403).json({ success: false, published: 0 })
  }

  try {
    // 1️⃣ Pick the next un-notified market
    const m = await prisma.market.findFirst({
      where: {
        status:    'open',
        notified:  false,
        eventTime: { gt: new Date() },
      },
      orderBy: { eventTime: 'asc' },
    })

    if (!m) {
      return res.status(200).json({ success: true, published: 0 })
    }

    // 2️⃣ Build core HTML block
    const coreHtml = formatMarketHtml(m)

    // 3️⃣ Prepare inline‐keyboard URLs
    const baseUrl = (process.env.BOT_WEB_URL || '').replace(/\/$/, '')
    const yesUrl  = `${baseUrl}/trade/${m.id}?side=yes`
    const noUrl   = `${baseUrl}/trade/${m.id}?side=no`

    // 4️⃣ Full HTML with inline buttons
    const fullHtml = `
${coreHtml}

<a href="${yesUrl}">✅ Trade YES</a>   <a href="${noUrl}">❌ Trade NO</a>
`.trim()

    // 5️⃣ Send to your public channel
    await sendTelegramMessage({
      chat_id:                  process.env.TELEGRAM_CHANNEL_ID!,
      text:                     fullHtml,
      parse_mode:               'HTML',
      disable_web_page_preview: true,
      reply_markup: JSON.stringify({
        inline_keyboard: [
          [{ text: '✅ Trade YES', url: yesUrl }, { text: '❌ Trade NO', url: noUrl }]
        ]
      }),
    })

    // 6️⃣ Mark as notified
    await prisma.market.update({
      where: { id: m.id },
      data:  { notified: true },
    })

    return res.status(200).json({ success: true, published: 1, id: m.id })
  } catch (err: any) {
    console.error('publish-markets error:', err)
    await sendAdminAlert(`❌ publish-markets crashed: ${err.message}`)
    return res.status(500).json({ success: false, published: 0, error: err.message })
  }
}
