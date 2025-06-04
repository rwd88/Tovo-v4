// pages/api/cron/import-markets.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'
import { parseStringPromise } from 'xml2js'
import { prisma } from '../../../lib/prisma'

interface CalendarEvent {
  id?: string;
  url?: string;
  title?: string;
  date?: string;
  time?: string;
  impact?: string;
  forecast?: string;
  actual?: string;
  previous?: string;
}

interface ApiResponse {
  success: boolean
  tradesDeleted?: number
  marketsDeleted?: number
  added?: number
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  const auth = req.headers.authorization
  if (!process.env.CRON_SECRET) {
    console.error('CRON_SECRET not configured')
    return res.status(500).json({
      success: false,
      error: 'Server configuration error'
    })
  }
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn('Unauthorized cron attempt')
    return res.status(403).json({
      success: false,
      error: 'Unauthorized'
    })
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Only GET requests are allowed'
    })
  }

  console.log('⏳ Starting market import cron job')

  try {
    console.log('→ Clearing previous trades and markets...')
    const tradesDel = await prisma.trade.deleteMany({})
    const marketsDel = await prisma.market.deleteMany({})
    console.log(`✔ Deleted ${tradesDel.count} trades, ${marketsDel.count} markets`)

    const CAL_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.xml'
    console.log(`→ Fetching calendar from ${CAL_URL}`)

    const { data: xml } = await axios.get<string>(CAL_URL, {
      responseType: 'text',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ForexFactoryBot/1.0)',
      },
    })

    const parsed = await parseStringPromise(xml, {
      explicitArray: false,
      trim: true,
    })

    const events: CalendarEvent[] = parsed?.weeklyevents?.event
      ? Array.isArray(parsed.weeklyevents.event)
        ? parsed.weeklyevents.event
        : [parsed.weeklyevents.event]
      : []

    console.log(`→ Found ${events.length} events`)

    const toCreate = events
      .filter(ev => {
        const isHigh = typeof ev.impact === 'string' && ev.impact.trim().toLowerCase() === 'high';
        if (isHigh) {
          console.log(`✔ High impact: ${ev.title} @ ${ev.date} ${ev.time}`);
        }
        return isHigh;
      })
.map((ev: CalendarEvent) => {
  const date = ev.date?.trim() || ''
  const time = ev.time?.trim().toLowerCase() || ''
  const eventName = ev.title?.trim() || ''
  const forecastText = ev.forecast?.trim() || ''

  // Convert MM-DD-YYYY to YYYY-MM-DD
  const [month, day, year] = date.split('-')
  if (!month || !day || !year) {
    console.warn(`⚠ Invalid date format: "${date}" from "${eventName}"`)
    return null
  }
  const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`

  // Convert time like "2:30pm" to "14:30"
  let formattedTime = ''
  const timeMatch = time.match(/^(\d{1,2})(:(\d{2}))?(am|pm)$/)
  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10)
    const minutes = timeMatch[3] || '00'
    const period = timeMatch[4]

    if (period === 'pm' && hour < 12) hour += 12
    if (period === 'am' && hour === 12) hour = 0

    formattedTime = `${hour.toString().padStart(2, '0')}:${minutes}`
  } else {
    console.warn(`⚠ Invalid time format: "${time}" from "${eventName}"`)
    return null
  }

  const eventTime = new Date(`${isoDate}T${formattedTime}`)
  if (isNaN(eventTime.getTime())) {
    console.warn(`⚠ Still invalid datetime: "${isoDate}T${formattedTime}" from "${eventName}"`)
    return null
  }

  return {
    externalId: ev.url || (eventName + date + time),
    question: eventName,
    status: 'open' as const,
    eventTime: eventTime.toISOString(),
    forecast: forecastText ? parseFloat(forecastText) : 0,
    outcome: null,
    poolYes: 0,
    poolNo: 0,
  }
})

      .filter((v): v is NonNullable<typeof v> => Boolean(v))

    let added = 0
    const batchSize = 100
    for (let i = 0; i < toCreate.length; i += batchSize) {
      const batch = toCreate.slice(i, i + batchSize)
      try {
        const { count } = await prisma.market.createMany({
          data: batch,
          skipDuplicates: true,
        })
        added += count
      } catch (batchError) {
        console.error(`Error processing batch ${i / batchSize + 1}:`, batchError)
      }
    }
    console.log(`✔ Created ${added} new markets`)

    return res.status(200).json({
      success: true,
      tradesDeleted: tradesDel.count,
      marketsDeleted: marketsDel.count,
      added,
    })

  } catch (err) {
    console.error('❌ Market import failed:', err)
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error occurred'
    })
  }
}
