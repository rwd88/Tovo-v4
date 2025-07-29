// pages/api/cron/import-markets.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'
import { parseStringPromise } from 'xml2js'
import { prisma } from '../../../lib/prisma'
import { sendAdminAlert } from '../../../lib/telegram'

export const config = {
  api: { bodyParser: false },
  maxDuration: 60, // up to 60s for XML fetch
}

interface ImportResponse {
  success: boolean
  added:   number
  skipped: number
  error?:  string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ImportResponse>
) {
  // 🔐 Auth
  const token =
    (req.query.secret as string) ||
    (req.headers['x-cron-secret'] as string) ||
    ''
  if (token !== process.env.CRON_SECRET) {
    await sendAdminAlert('⚠️ Unauthorized import-markets call')
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
    // 1) Fetch & parse XML
    const CAL_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.xml'
    const { data: xml } = await axios.get<string>(CAL_URL)
    const parsed = await parseStringPromise(xml, {
      explicitArray: false,
      trim:          true,
    })
    const events: any[] = parsed?.weeklyevents?.event
      ? Array.isArray(parsed.weeklyevents.event)
        ? parsed.weeklyevents.event
        : [parsed.weeklyevents.event]
      : []

    let added = 0, skipped = 0
    const now = new Date()

    // 2) Upsert loop
    for (const ev of events) {
      // only high-impact
      if (ev.impact?.trim().toLowerCase() !== 'high') {
        skipped++; continue
      }
      // notify admin that we saw this event
      await sendAdminAlert(
        `🚨 High-Impact Event\n${ev.title}\nDate: ${ev.date} ${ev.time}`
      )

      // parse date/time
      const dateStr = ev.date?.trim(), rawTime = ev.time?.trim().toLowerCase()
      if (!dateStr || !rawTime) { skipped++; continue }
      const m = rawTime.match(/^(\d{1,2}):(\d{2})(am|pm)$/)
      if (!m) { skipped++; continue }
      let hour = parseInt(m[1], 10)
      if (m[3] === 'pm' && hour < 12) hour += 12
      if (m[3] === 'am' && hour === 12) hour = 0
      const minute = m[2]
      const [mm, dd, yyyy] = dateStr.split('-')
      const iso = `${yyyy}-${mm}-${dd}T${hour
        .toString()
        .padStart(2, '0')}:${minute}:00Z`
      const eventTime = new Date(iso)
      if (isNaN(eventTime.getTime()) || eventTime < now) {
        skipped++; continue
      }

      const externalId   = ev.url?.trim() ||
                           `ff-${ev.title}-${mm}${dd}-${hour}${minute}`
      const forecastVal  = ev.forecast ? parseFloat(ev.forecast) : undefined

      await prisma.market.upsert({
        where:  { externalId },
        update: forecastVal != null ? { forecast: forecastVal } : {},
        create: {
          externalId,
          question:  ev.title.trim(),
          status:    'open',
          eventTime,
          poolYes:   0,
          poolNo:    0,
          notified:  false,
          resolved:  false,
          ...(forecastVal != null ? { forecast: forecastVal } : {}),
        },
      })
      added++
    }

    return res.status(200).json({ success: true, added, skipped })
  } catch (err: any) {
    console.error('import-markets error:', err)
    await sendAdminAlert(`import-markets failed: ${err.message}`)
    return res
      .status(500)
      .json({ success: false, added: 0, skipped: 0, error: err.message })
  }
}
