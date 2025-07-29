import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'
import { parseStringPromise } from 'xml2js'
import { prisma } from '../../../lib/prisma'
import { notifyAdmin } from '../../../lib/market-utils'
import { autoPublishMarkets } from '../../../src/services/autoPublishMarkets'

interface ApiResponse {
  success: boolean
  added: number
  skipped: number
  published?: number
  publishIds?: string[]
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
    // Debug: Verify Telegram config
    console.log('[DEBUG] Telegram Config:', {
      hasToken: !!process.env.TELEGRAM_BOT_TOKEN,
      hasChatId: !!process.env.ADMIN_TELEGRAM_ID
    })

    // 1) fetch the XML
    const CAL_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.xml'
    const { data: xml } = await axios.get<string>(CAL_URL)
    const parsed = await parseStringPromise(xml, {
      explicitArray: false,
      trim: true,
    })

    const events: any[] = parsed?.weeklyevents?.event
      ? Array.isArray(parsed.weeklyevents.event)
        ? parsed.weeklyevents.event
        : [parsed.weeklyevents.event]
      : []
    console.log(`[DEBUG] Found ${events.length} events`)

    // 2) upsert
    let added = 0,
      skipped = 0
    const now = new Date()

    for (const ev of events) {
      const isHighImpact = ev.impact?.trim().toLowerCase() === 'high'
      console.log(`[DEBUG] Processing: ${ev.title} | High Impact: ${isHighImpact}`)

      if (!isHighImpact) {
        skipped++
        continue
      }

      // Send Telegram notification
      try {
        const message = `🚨 *High Impact Event*\n• ${ev.title}\n• ${ev.date} ${ev.time}`
        console.log('[DEBUG] Sending Telegram:', message)
        await notifyAdmin(message)
      } catch (err) {
        console.error('[ERROR] Telegram failed:', err)
      }

      // parse date & time...
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
      const [mm, dd, yyyy] = dateStr.split('-')
      const iso = `${yyyy}-${mm}-${dd}T${hour.toString().padStart(2, '0')}:${minute}:00Z`
      const eventTime = new Date(iso)
      if (isNaN(eventTime.getTime())) {  // ← Added missing `)`
  console.error('[ERROR] Invalid date for event:', ev.title, iso)
  skipped++
  continue
}
      if (eventTime < now) {
        skipped++
        continue
      }

      const externalId = ev.url?.trim() || `ff-${ev.title}-${dateStr}-${hour}${minute}`
      const forecastVal = ev.forecast ? parseFloat(ev.forecast) : null

      await prisma.market.upsert({
        where: { externalId },
        update: forecastVal != null ? { forecast: forecastVal } : {},
        create: {
          externalId,
          question: ev.title?.trim() ?? 'Untitled Event',
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
    }

    // 3) auto-publish if asked
    let published: number | undefined
    let publishIds: string[] | undefined

    if (req.query.publish === 'true') {
      const result = await autoPublishMarkets()
      published = result.published
      publishIds = result.ids
    }

    return res.status(200).json({
      success: true,
      added,
      skipped,
      ...(published != null ? { published, publishIds } : {}),
    })
  } catch (err: any) {
    console.error('❌ import-markets error:', err)
    await notifyAdmin(`import-markets failed: ${err.message}`)
    return res
      .status(500)
      .json({ success: false, added: 0, skipped: 0, error: err.message })
  }
}