// pages/api/cron/import-markets.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'
import { parseStringPromise } from 'xml2js'
import { prisma } from '../../../lib/prisma'
import { notifyAdmin } from '../../../lib/market-utils'
import { autoPublishMarkets } from '../../../src/services/autoPublishMarkets'

interface ApiResponse {
  success:   boolean
  added:     number
  skipped:   number
  published: number
  publishIds: string[]
  error?:    string
}

export const config = { api: { bodyParser: false }, maxDuration: 60 }

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // Authorize
  const token =
    (req.query.secret as string) ||
    req.headers.authorization?.replace('Bearer ', '') ||
    ''
  if (token !== process.env.CRON_SECRET) {
    return res.status(403).json({ success: false, added:0, skipped:0, published:0, publishIds:[], error:'Unauthorized' })
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ success:false, added:0, skipped:0, published:0, publishIds:[], error:'Only GET' })
  }

  try {
    // Fetch & parse
    const CAL_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.xml'
    const { data: xml } = await axios.get<string>(CAL_URL)
    const parsed = await parseStringPromise(xml, { explicitArray:false, trim:true })
    const events: any[] = parsed?.weeklyevents?.event
      ? Array.isArray(parsed.weeklyevents.event)
        ? parsed.weeklyevents.event
        : [parsed.weeklyevents.event]
      : []

    let added = 0, skipped = 0
    const now = new Date()
    for (const ev of events) {
      if (ev.impact?.trim().toLowerCase() !== 'high') {
        skipped++; continue
      }

      // Admin alert
      await notifyAdmin(`🚨 *High-Impact Event*\n• ${ev.title} • ${ev.date} ${ev.time}`)

      // Parse date/time
      const [mm, dd, yyyy] = ev.date.split('-')
      const m = ev.time.toLowerCase().match(/^(\d{1,2}):(\d{2})(am|pm)$/)!
      let hour = parseInt(m[1],10)
      if (m[3]==='pm'&&hour<12) hour+=12
      if (m[3]==='am'&&hour===12) hour=0
      const minute = m[2]
      const iso = `${yyyy}-${mm}-${dd}T${hour.toString().padStart(2,'0')}:${minute}:00Z`
      const eventTime = new Date(iso)
      if (isNaN(eventTime.getTime()) || eventTime < now) {
        skipped++; continue
      }

      const externalId = ev.url?.trim()||`ff-${ev.title}-${mm}${dd}${hour}${minute}`
      const forecastVal = ev.forecast ? parseFloat(ev.forecast) : undefined

      await prisma.market.upsert({
        where: { externalId },
        update: forecastVal!=null ? { forecast: forecastVal } : {},
        create: {
          externalId,
          question:   ev.title,
          status:     'open',
          eventTime,
          poolYes:    0,
          poolNo:     0,
          notified:   false,
          resolved:   false,
          ...(forecastVal!=null?{forecast:forecastVal}:{})
        },
      })
      added++
    }

    // *** IMMEDIATE PUBLISH ***
    const { published, ids } = await autoPublishMarkets()
    console.log('[PUBLISHED] Markets:', published)

    return res.status(200).json({ success:true, added, skipped, published, publishIds:ids })
  } catch (err:any) {
    console.error('import-markets error:', err)
    await notifyAdmin(`import-markets crashed: ${err.message}`)
    return res.status(500).json({ success:false, added:0, skipped:0, published:0, publishIds:[], error:err.message })
  }
}
