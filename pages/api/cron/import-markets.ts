// pages/api/cron/import-markets.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'
import { parseStringPromise } from 'xml2js'
import { prisma } from '../../../lib/prisma'

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
  // 0) Verify cron secret
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

  // 1) Only GET
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Only GET requests are allowed'
    })
  }

  console.log('⏳ Starting market import cron job')

  try {
    // 2) Delete existing trades
    console.log('→ Clearing previous trades...')
    const tradesDel = await prisma.trade.deleteMany({})
    console.log(`✔ Deleted ${tradesDel.count} trades`)

    // 3) Delete existing markets
    console.log('→ Clearing previous markets...')
    const marketsDel = await prisma.market.deleteMany({})
    console.log(`✔ Deleted ${marketsDel.count} markets`)

    // 4) Fetch the current week's calendar (XML)
    const CAL_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.xml'
    console.log(`→ Fetching calendar XML from ${CAL_URL}`)

    const { data: xml } = await axios.get<string>(CAL_URL, {
      responseType: 'text',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ForexFactoryBot/1.0)',
      }
    })

    // 5) Parse XML
    const parsed = await parseStringPromise(xml, { explicitArray: false })
    const events = parsed?.weeklyevents?.event
      ? Array.isArray(parsed.weeklyevents.event)
        ? parsed.weeklyevents.event
        : [parsed.weeklyevents.event]
      : []

    console.log(`→ Found ${events.length} events in XML`)

    // 6) Prepare data to insert
    const toCreate = events
      .map((event: any) => {
        // Try to build a unique ID: date + time + title
        const date = event.date?.replace(/\[|\]|<!\[CDATA\[|\]\]>/g, '').trim() || ''
        const time = event.time?.replace(/\[|\]|<!\[CDATA\[|\]\]>/g, '').trim() || ''
        const question = event.title?.replace(/\[|\]|<!\[CDATA\[|\]\]>/g, '').trim() || ''
        const forecastText = event.forecast?.replace(/\[|\]|<!\[CDATA\[|\]\]>/g, '').trim() || ''
        const eventTime = `${date} ${time}`.trim()
        let eventTimeISO: string | null = null

        // Try to parse eventTime to ISO
        if (date && time) {
          const tryDate = new Date(`${date} ${time}`)
          eventTimeISO = isNaN(tryDate.getTime()) ? null : tryDate.toISOString()
        }

        if (!eventTimeISO) return null

        return {
          externalId: `${eventTimeISO}-${question}`,
          question,
          status: 'open' as const,
          eventTime: eventTimeISO,
          forecast: forecastText ? parseFloat(forecastText) : 0,
          outcome: null,
          poolYes: 0,
          poolNo: 0,
        }
      })
      .filter(Boolean)

    // 7) Insert in batches
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
        console.error(`Error processing batch ${i/batchSize + 1}:`, batchError)
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
