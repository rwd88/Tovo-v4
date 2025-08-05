// pages/api/cron/publish-market/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { sendTelegramMessage } from '@/lib/telegram'
import { formatMarketHtml } from '@/lib/market-utils'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string }
  if (req.query.secret !== process.env.CRON_SECRET) {
    return res.status(403).json({ success: false })
  }

  const m = await prisma.market.findUnique({ where: { id } })
  if (!m) return res.status(404).json({ success: false })

  // build & send exactly like your publish-markets logic
  const coreHtml = formatMarketHtml(m)
  const yesUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/trade/${m.id}?side=yes`
  const noUrl  = `${process.env.NEXT_PUBLIC_SITE_URL}/trade/${m.id}?side=no`

  await sendTelegramMessage({
    chat_id: process.env.TELEGRAM_CHANNEL_ID!,
    text: `<b>${m.question}</b>\nEnds ${m.eventTime.toUTCString()}\n\n✅ <a href="${yesUrl}">Yes</a>   ❌ <a href="${noUrl}">No</a>`,
    parse_mode: 'HTML',
  })

  await prisma.market.update({ where: { id }, data: { notified: true } })
  return res.status(200).json({ success: true })
}
