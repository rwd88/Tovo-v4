/* eslint-disable */
 /* eslint-disable @typescript-eslint/no-explicit-any */

// File: pages/api/cron/import-markets.ts

  import type { NextApiRequest, NextApiResponse } from 'next'
  import axios from 'axios'
  import * as cheerio from 'cheerio'
  import { prisma } from '../../../lib/prisma'

  export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
  ) {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Only GET allowed' })
    }

    console.log('⏳ import-markets cron start')

    try {
      // 1) Wipe out yesterday's trades
      console.log('→ Deleting all trades…')
      const tradesDel = await prisma.trade.deleteMany({})
      console.log(`✔ Trades deleted: ${tradesDel.count}`)

      // 2) Wipe out yesterday's markets
      console.log('→ Deleting all markets…')
      const marketsDel = await prisma.market.deleteMany({})
      console.log(`✔ Markets deleted: ${marketsDel.count}`)

      // 3) Fetch this week’s calendar HTML
 const CAL_URL = 'https://www.forexfactory.com/calendar.php?week=this'
console.log(`→ Fetching calendar HTML from ${CAL_URL}`)
const { data: html } = await axios.get<string>(CAL_URL, {
  responseType: 'text',
  headers: {
    'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection':      'keep-alive',
  },
})
      console.log('✔ HTML fetched, loading into cheerio…')

      // 4) Parse out all high-impact (red) rows
      const $ = cheerio.load(html)
// ForexFactory now marks red events with <span class="impact-icon impact-icon--high">
const rows = $('span.impact-icon--high').closest('tr')

      console.log(`→ Found ${rows.length} high-impact rows`)

      // 5) Map every row to a Market record
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
          const eventTime = new Date(`${dateText} ${timeText}`).toISOString()

          return {
            question: $row.find('td.calendar__event').text().trim(),
            status: 'open' as const,
            eventTime,
            forecast: parseFloat(
              $row.find('td.calendar__forecast').text().trim() || '0'
            ),
            outcome: null as string | null,
            poolYes: 0,
            poolNo: 0,
          }
        })
        .get() // Cheerio → real array
      console.log(`→ Prepared ${toCreate.length} market records for insertion`)

// 6) Bulk-insert them all in chunks of 100, accumulating a total count
let added = 0
for (let i = 0; i < toCreate.length; i += 100) {
  const chunk = toCreate.slice(i, i + 100)
  const { count } = await prisma.market.createMany({ data: chunk })
  added += count
}
console.log(`✔ Markets created: ${added}`)


      // 7) Return summary
      return res.status(200).json({
        success: true,
        tradesDeleted: tradesDel.count,
        marketsDeleted: marketsDel.count,
        added,
      })
    } catch (err: any) {
      console.error('🔥 import-markets cron failed:', err)
      return res
        .status(500)
        .json({ success: false, error: err.message || 'Unknown error' })
    }
  }
