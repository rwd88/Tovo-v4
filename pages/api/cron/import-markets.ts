// pages/api/cron/import-markets.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'
import * as cheerio from 'cheerio'
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

    // 4) Fetch current week's calendar
    const CAL_URL = 'https://www.forexfactory.com/calendar.php?week=this'
    console.log(`→ Fetching calendar from ${CAL_URL}`)
    
    const { data: html } = await axios.get<string>(CAL_URL, {
      responseType: 'text',
      timeout: 10000, // 10 second timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })

    console.log('✔ HTML fetched successfully')
    const $ = cheerio.load(html)

    // 5) Parse high-impact events
    const rows = $('span.impact-icon--high').closest('tr')
    console.log(`→ Found ${rows.length} high-impact events`)

    // 6) Prepare market data
    const toCreate = rows
      .map((_, el) => {
        const $row = $(el)
        
        const timeText = $row.find('td.calendar__time').text().trim()
        const dateText = $row
          .prevAll('tr.calendar__row--date')
          .first()
          .find('th')
          .text()
          .trim()
          
        const eventTime = new Date(`${dateText} ${timeText}`)
        if (isNaN(eventTime.getTime())) {
          console.warn('Invalid date for event:', $row.find('td.calendar__event').text().trim())
          return null
        }

        const eventName = $row.find('td.calendar__event').text().trim()
        const forecastText = $row.find('td.calendar__forecast').text().trim()
        
        return {
          externalId: `${eventTime.toISOString()}-${eventName}`,
          question: eventName,
          status: 'open' as const,
          eventTime: eventTime.toISOString(),
          forecast: forecastText ? parseFloat(forecastText) : 0,
          outcome: null,
          poolYes: 0,
          poolNo: 0,
        }
      })
      .get()
      .filter(Boolean) // Filter out any null entries from failed date parsing

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