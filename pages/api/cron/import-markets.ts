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
    return res.status(500).json({ success: false, error: 'Server configuration error' })
  }

  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn('Unauthorized cron attempt')
    return res.status(403).json({ success: false, error: 'Unauthorized' })
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Only GET requests are allowed' })
  }

  console.log('⏳ Starting market import cron job')

  try {
    const tradesDel = await prisma.trade.deleteMany({})
    const marketsDel = await prisma.market.deleteMany({})
    console.log(`✔ Deleted ${tradesDel.count} trades, ${marketsDel.count} markets`)

    const CAL_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.xml'
    const { data: xml } = await axios.get<string>(CAL_URL, {
      responseType: 'text',
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (ForexFactoryBot/1.0)' },
    })

    const parsed = await parseStringPromise(xml, { explicitArray: false, trim: true })
    const events: CalendarEvent[] = parsed?.weeklyevents?.event
      ? Array.isArray(parsed.weeklyevents.event)
        ? parsed.weeklyevents.event
        : [parsed.weeklyevents.event]
      : []

    const today = new Date().toISOString().split('T')[0] // e.g., "2025-06-04"
    console.log('✅ Today is:', today)
    console.log('🔍 Previewing event dates:')
    events.slice(0, 10).forEach(ev => {
      console.log(`- ${ev.title} @ ${ev.date} ${ev.time}, impact: ${ev.impact}`)
    })

    const toCreate = events
      .filter(ev =>
        typeof ev.impact === 'string' &&
        ev.impact.trim().toLowerCase() === 'high' &&
        typeof ev.date === 'string' &&
        ev.date.trim().startsWith(today)
      )
      .map(ev => {
        const date = ev.date?.trim() || ''
        const time = ev.time?.trim() || ''
        const eventName = ev.title?.trim() || ''
        const forecastText = ev.forecast?.trim() || ''
        const eventTime = new Date(`${date} ${time}`)

        if (isNaN(eventTime.getTime())) return null

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
        console.error(`❌ Error processing batch ${i / batchSize + 1}:`, batchError)
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
