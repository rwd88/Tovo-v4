// src/pages/api/cron/import-markets.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'
import { parseStringPromise } from 'xml2js'
import { prisma } from '../../../lib/prisma'
import { formatMarketMessage, notifyAdmin } from '../../../lib/market-utils'
import { sendTelegramMessage } from '../../../lib/telegram'

interface CalendarEvent {
  url?: string
  title?: string
  date?: string
  time?: string
  impact?: string
  forecast?: string
}

interface ApiResponse {
  success: boolean
  added: number
  skipped: number
  error?: string
}

export const config = {
  api: { bodyParser: false },
  maxDuration: 60,
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // 🔐 authorize
  const token = (
    (req.query.secret  as string) ||
    req.headers.authorization?.replace('Bearer ', '') ||
    (req.headers['x-cron-secret'] as string) ||
    ''
  )

  if (token !== process.env.CRON_SECRET) {
    return res
      .status(403)
      .json({ success: false, added: 0, skipped: 0, error: 'Unauthorized' })
  }
  if (req.method !== 'GET') {
    return res
      .status(405)
      .json({ success: false, added: 0, skipped: 0, error: 'Only GET allowed' })
  }

  try {
    const CAL_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.xml'
    const { data: xml } = await axios.get<string>(CAL_URL)
    const parsed = await parseStringPromise(xml, {
      explicitArray: false,
      trim: true,
    })

    const events: CalendarEvent[] = parsed?.weeklyevents?.event
      ? Array.isArray(parsed.weeklyevents.event)
        ? parsed.weeklyevents.event
        : [parsed.weeklyevents.event]
      : []

    let added = 0, skipped = 0
    const now = new Date()

    for (const ev of events) {
      if (ev.impact?.trim().toLowerCase() !== 'high') {
        skipped++
        continue
      }

      // parse date + time
      const dateStr = ev.date?.trim()
      const rawTime = ev.time?.trim().toLowerCase()
      if (!dateStr || !rawTime) {
        skipped++
        continue
      }
      const m = rawTime.match(/^(\d{1,2}):(\d{2})(am|pm)$/)
      if (!m) {
        skipped++
        continue
      }
      let hour = parseInt(m[1], 10)
      if (m[3] === 'pm' && hour < 12) hour += 12
      if (m[3] === 'am' && hour === 12) hour = 0
      const minute = m[2]
      const [mm, dd, yyyy] = dateStr.split('-')  // expecting MM-DD-YYYY
      const iso = `${yyyy}-${mm}-${dd}T${hour.toString().padStart(2,'0')}:${minute}:00Z`
      const eventTime = new Date(iso)
      if (isNaN(eventTime.getTime()) || eventTime < now) {
        skipped++
        continue
      }

      const externalId =
        ev.url?.trim() ||
        `ff-${ev.title}-${dateStr}-${hour.toString().padStart(2,'0')}${minute}`
      const forecastVal = ev.forecast ? parseFloat(ev.forecast) : null

      // upsert into your DB
      await prisma.market.upsert({
        where: { externalId },
        update: {
          ...(forecastVal != null ? { forecast: forecastVal } : {}),
        },
        create: {
          externalId,
          question:   ev.title?.trim() ?? 'Untitled Event',
          status:     'open',
          eventTime,
          poolYes:    0,
          poolNo:     0,
          notified:   false,
          resolved:   false,
          ...(forecastVal != null ? { forecast: forecastVal } : {}),
        },
      })
      added++

      // announce on Telegram
      const msg = formatMarketMessage({
        // we only need these five for the announcement
        externalId,
        question: ev.title!.trim(),
        eventTime,
        poolYes: 0,
        poolNo: 0,
        forecast: forecastVal ?? undefined,
        status: 'open'
      } as any)

      await sendTelegramMessage({
        chat_id: process.env.TELEGRAM_CHANNEL_ID!,
        text: msg,
        parse_mode: 'Markdown',
      })
    }

    return res.status(200).json({ success: true, added, skipped })
  } catch (err: any) {
    console.error('❌ import-markets error:', err)
    await notifyAdmin(`import-markets failed: ${err.message}`)
    return res
      .status(500)
      .json({ success: false, added: 0, skipped: 0, error: err.message })
  }
}
