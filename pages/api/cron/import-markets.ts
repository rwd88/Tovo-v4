// pages/api/cron/import-markets.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'
import { parseStringPromise } from 'xml2js'
import { prisma } from '../../../lib/prisma'
import { sendAdminAlert } from '../../../lib/telegram'

export const config = {
  api: { bodyParser: false },
  maxDuration: 60,
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
  // 1) Auth
  const token =
    (req.query.secret as string) ||
    (req.headers['x-cron-secret'] as string) ||
    ''
  if (token !== process.env.CRON_SECRET) {
    await sendAdminAlert('⚠️ Unauthorized import-markets call')
    return res
      .status(403)
      .json({ success: false, added: 0, skipped: 0, error: 'Forbidden' })
  }
  if (req.method !== 'GET') {
    return res
      .status(405)
      .json({ success: false, added: 0, skipped: 0, error: 'Only GET allowed' })
  }

  try {
    // 2) Fetch & parse the XML
    const CAL_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.xml'
    const { data: xml } = await axios.get<string>(CAL_URL)
    const parsed = await parseStringPromise(xml, {
      explicitArray: false,
      trim:          true,
    })
    const raw = parsed?.weeklyevents?.event
    const events = raw
      ? Array.isArray(raw)
        ? raw
        : [raw]
      : []

    let added = 0, skipped = 0
    const now = Date.now()

    for (const ev of events) {
      // only “High” impact
      if (ev.impact?.trim().toLowerCase() !== 'high') {
        skipped++
        continue
      }

      // parse time
      const dateStr = ev.date?.trim()    // MM-DD-YYYY
      const t = ev.time?.trim().toLowerCase() // e.g. “8:30am”
      if (!dateStr || !t) { skipped++; continue }
      const m = t.match(/^(\d{1,2}):(\d{2})(am|pm)$/)
      if (!m) { skipped++; continue }
      let hour = parseInt(m[1],10)
      if (m[3] === 'pm' && hour < 12) hour += 12
      if (m[3] === 'am' && hour === 12) hour = 0
      const [mm, dd, yyyy] = dateStr.split('-')
      const iso = `${yyyy}-${mm}-${dd}T${hour.toString().padStart(2,'0')}:${m[2]}:00Z`
      const eventTime = new Date(iso)
      if (isNaN(eventTime.getTime()) || eventTime.getTime() < now) {
        skipped++
        continue
      }

      // pull forecast out of XML, if present
      const rawForecast = ev.forecast?.trim()
      const forecastVal = rawForecast && !isNaN(Number(rawForecast))
        ? parseFloat(rawForecast)
        : null

      const externalId = ev.url?.trim() ||
        `ff-${ev.title}-${mm}${dd}-${hour}${m[2]}`

      // 3) Upsert into your markets table, **including** forecast
      await prisma.market.upsert({
        where: { externalId },
        update: {
          // ALWAYS overwrite forecast if XML provides it
          ...(forecastVal != null ? { forecast: forecastVal } : {}),
        },
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
    console.error('import-markets crashed:', err)
    await sendAdminAlert(`import-markets failed: ${err.message}`)
    return res
      .status(500)
      .json({ success: false, added: 0, skipped: 0, error: err.message })
  }
}
