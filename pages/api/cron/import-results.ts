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
  // 1️⃣ Authenticate
  const providedSecret =
    (req.query.secret as string) ||
    req.headers.authorization?.split(' ')[1]

  if (!process.env.CRON_SECRET) {
    console.error('CRON_SECRET not set')
    return res.status(500).json({
      success: false,
      error: 'Server misconfiguration',
    })
  }
  if (providedSecret !== process.env.CRON_SECRET) {
    console.warn('⚠️ Unauthorized import-results request')
    return res.status(403).json({ success: false, error: 'Unauthorized' })
  }

  console.log('⏳ Starting results import…')

  try {
    // 2️⃣ Fetch & parse the XML feed
    const feedUrl = 'https://nfs.faireconomy.media/ff_calendar_thisweek.xml'
    const { data: xml } = await axios.get<string>(feedUrl, {
      responseType: 'text',
      timeout: 10000,
      headers: { 'User-Agent': 'ForecastBot/1.0' },
    })
    const parsed = await parseStringPromise(xml, { explicitArray: false, trim: true })

    // 3️⃣ Normalize into an array
    const items = parsed?.weeklyevents?.event
      ? Array.isArray(parsed.weeklyevents.event)
        ? parsed.weeklyevents.event
        : [parsed.weeklyevents.event]
      : []

    console.log(`→ ${items.length} events found`)

    // 4️⃣ Update past/open/unresolved markets
    let processed = 0
    const failures: string[] = []
    const skipped: string[] = []

    const now = new Date()
    for (const item of items) {
      const eventId = item.id || item.url || `${item.title}-${item.date}-${item.time}`
      const actualRaw = item.actual?.trim()
      const forecastRaw = item.forecast?.trim()

      // must have an ID and an actual
      if (!eventId || !actualRaw) {
        skipped.push(eventId || '<missing-id>')
        continue
      }

      // optional: parse as numbers
      const actualVal = parseFloat(actualRaw)
      const forecastVal = forecastRaw ? parseFloat(forecastRaw) : NaN

      try {
        const result = await prisma.market.updateMany({
          where: {
            externalId: eventId,
            status: 'open',           // only still-open markets
            resolved: false,           // only unresolved
            eventTime: { lte: now },   // whose time has passed
          },
          data: {
            outcome: actualRaw,        // store raw string (or use actualVal)
            forecast: !isNaN(forecastVal) ? forecastVal : undefined,
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
        console.error(`❌ Failed to update ${eventId}:`, err)
        failures.push(eventId)
      }
    }

    console.log(`✔ Import done: ${processed} updated, ${failures.length} failures, ${skipped.length} skipped`)

    return res.status(200).json({
      success: true,
      importedResults: processed,
      failures,
      warning: skipped.length ? `${skipped.length} skipped` : undefined,
    })
  } catch (err: any) {
    console.error('❌ import-results error:', err)
    return res.status(500).json({
      success: false,
      error: err.message,
    })
  }
}
