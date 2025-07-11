// pages/api/cron/import-results.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'
import { parseStringPromise } from 'xml2js'
import { prisma } from '../../../lib/prisma'

interface ApiResponse {
  success: boolean
  importedResults?: number
  failures?: string[]
  warning?: string
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // 1️⃣ Auth
  const providedSecret =
    (req.query.secret as string) ||
    req.headers.authorization?.split(' ')[1]
  if (!process.env.CRON_SECRET) {
    console.error('CRON_SECRET missing')
    return res.status(500).json({ success: false, error: 'Server misconfigured' })
  }
  if (providedSecret !== process.env.CRON_SECRET) {
    console.warn('Unauthorized import-results request')
    return res.status(403).json({ success: false, error: 'Unauthorized' })
  }

  console.log('⏳ Starting import-results…')

  try {
    // 2️⃣ Fetch & parse XML
    const feedUrl = 'https://nfs.faireconomy.media/ff_calendar_thisweek.xml'
    const { data: xml } = await axios.get<string>(feedUrl, {
      responseType: 'text',
      timeout: 10000,
    })
    const parsed = await parseStringPromise(xml, { explicitArray: false, trim: true })

    // 3️⃣ Normalize to array
    const events = parsed?.weeklyevents?.event
      ? Array.isArray(parsed.weeklyevents.event)
        ? parsed.weeklyevents.event
        : [parsed.weeklyevents.event]
      : []

    console.log(`→ ${events.length} events fetched`)

    // 4️⃣ Loop & update
    let processed = 0
    const failures: string[] = []
    const skipped: string[] = []
    const now = new Date()

    for (const ev of events) {
      const eventId = ev.id || ev.url || `${ev.title}-${ev.date}-${ev.time}`
      const actualRaw = ev.actual?.trim()
      const forecastRaw = ev.forecast?.trim()

      // skip if no ID or no actual data
      if (!eventId || !actualRaw) {
        skipped.push(eventId || '<no-id>')
        continue
      }

      // optional parse
      const actualVal = parseFloat(actualRaw)
      const forecastVal = forecastRaw ? parseFloat(forecastRaw) : NaN

      try {
        // update only open, unresolved, past markets
        const result = await prisma.market.updateMany({
          where: {
            externalId: eventId,
            status: 'open',
            resolved: false,
            eventTime: { lte: now },
          },
          data: {
            resolvedOutcome: actualRaw,        // ← write into new column
            ...( !isNaN(forecastVal) && { 
              forecast: forecastVal 
            }),
            status: 'resolved',
            resolved: true,
            settledAt: now,
          },
        })

        if (result.count > 0) {
          processed += result.count
        } else {
          skipped.push(eventId)
        }
      } catch (err) {
        console.error(`❌ Could not update ${eventId}:`, err)
        failures.push(eventId)
      }
    }

    console.log(`✔ Complete: ${processed} ✓, ${failures.length} failed, ${skipped.length} skipped`)
    return res.status(200).json({
      success: true,
      importedResults: processed,
      failures,
      warning: skipped.length ? `${skipped.length} skipped` : undefined,
    })
  } catch (err: any) {
    console.error('❌ import-results error:', err)
    return res.status(500).json({ success: false, error: err.message })
  }
}
