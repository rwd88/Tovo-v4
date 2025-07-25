// src/pages/api/cron/import-markets.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'
import { parseStringPromise } from 'xml2js'
import { prisma } from '../../../lib/prisma'
import { formatMarketMessage } from '../../../lib/market-utils'
import { sendTelegramMessage, sendAdminAlert } from '../../../lib/telegram'

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
  const token =
    (req.query.secret as string) ||
    req.headers.authorization?.replace('Bearer ', '') ||
    (req.headers['x-cron-secret'] as string) ||
    ''

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

    const events: CalendarEvent[] = parsed.weeklyevents?.event
      ? Array.isArray(parsed.weeklyevents.event)
        ? parsed.weeklyevents.event
        : [parsed.weeklyevents.event]
      : []

    let added = 0
    let skipped = 0
    const now = new Date()

    for (const ev of events) {
      if (ev.impact?.trim().toLowerCase() !== 'high') {
        skipped++
        continue
      }
      // parse date + time (MM-DD-YYYY + “8:30am”)
      const [mm, dd, yyyy] = ev.date!.split('-')
      const tm = ev.time!.match(/^(\d{1,2}):(\d{2})(am|pm)$/i)
      if (!tm) {
        skipped++
        continue
      }
      let hr = parseInt(tm[1], 10)
      if (tm[3].toLowerCase() === 'pm' && hr < 12) hr += 12
      if (tm[3].toLowerCase() === 'am' && hr === 12) hr = 0
      const minute = tm[2]
      const iso = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(
        2,
        '0'
      )}T${hr.toString().padStart(2, '0')}:${minute}:00Z`
      const eventTime = new Date(iso)
      if (isNaN(eventTime.getTime()) || eventTime < now) {
        skipped++
        continue
      }

      const externalId =
        ev.url?.trim() ||
        `ff-${ev.title}-${ev.date}-${hr.toString().padStart(2, '0')}${minute}`
      const forecastVal = ev.forecast ? parseFloat(ev.forecast) : null

      await prisma.market.upsert({
        where: { externalId },
        update: {
          ...(forecastVal != null ? { forecast: forecastVal } : {}),
        },
        create: {
          externalId,
          question: ev.title!.trim(),
          status: 'open',
          eventTime,
          poolYes: 0,
          poolNo: 0,
          notified: false,
          resolved: false,
          ...(forecastVal != null ? { forecast: forecastVal } : {}),
        },
      })

      added++
      // announce via Telegram
      const msg = formatMarketMessage({
        externalId,
        question: ev.title!.trim(),
        eventTime,
        poolYes: 0,
        poolNo: 0,
        forecast: forecastVal ?? undefined,
        status: 'open',
      } as any)
      await sendTelegramMessage({ chat_id: process.env.TG_CHANNEL_ID!, text: msg })
    }

    return res.status(200).json({ success: true, added, skipped })
  } catch (err: any) {
    console.error('❌ import-markets error:', err)
    await sendAdminAlert(`import-markets failed: ${err.message}`)
    return res
      .status(500)
      .json({ success: false, added: 0, skipped: 0, error: err.message })
  }
}
