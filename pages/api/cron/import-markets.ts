// File: pages/api/cron/import-markets.ts
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
  // 0) verify cron secret
  const auth = req.headers.authorization
  if (!process.env.CRON_SECRET) {
    return res
      .status(500)
      .json({ success: false, error: 'CRON_SECRET not configured' })
  }
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(403).json({ success: false, error: 'Unauthorized' })
  }
}
  // 1) only GET
  if (req.method !== 'GET') {
    return res
      .status(405)
      .json({ success: false, error: 'Only GET allowed' })
  }

  console.log('⏳ import-markets cron start')

  try {
    // 2) delete yesterday’s trades
    console.log('→ Deleting all trades…')
    const tradesDel = await prisma.trade.deleteMany({})
    console.log(`✔ Trades deleted: ${tradesDel.count}`)

    // 3) delete yesterday’s markets
    console.log('→ Deleting all markets…')
    const marketsDel = await prisma.market.deleteMany({})
    console.log(`✔ Markets deleted: ${marketsDel.count}`)

    // 4) fetch this week’s calendar
    const CAL_URL = 'https://www.forexfactory.com/calendar.php?week=this'
    console.log(`→ Fetching calendar HTML from ${CAL_URL}`)
    const { data: html } = await axios.get<string>(CAL_URL, {
      responseType: 'text',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        Connection: 'keep-alive',
      },
    })
    console.log('✔ HTML fetched, loading into cheerio…')

    // 5) parse high-impact rows
    const $ = cheerio.load(html)
    const rows = $('span.impact-icon--high').closest('tr')
    console.log(`→ Found ${rows.length} high-impact rows`)

    // 6) build data array
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
      .get()
    console.log(`→ Prepared ${toCreate.length} market records`)

    // 7) bulk insert in chunks
    let added = 0
    for (let i = 0; i < toCreate.length; i += 100) {
      const result = await prisma.market.createMany({
        data: toCreate.slice(i, i + 100),
      })
      added += result.count
    }
    console.log(`✔ Markets created: ${added}`)

    // 8) respond
    return res.status(200).json({
      success: true,
      tradesDeleted: tradesDel.count,
      marketsDeleted: marketsDel.count,
      added,
    })
  } catch (err) {
    console.error('🔥 import-markets cron failed:', err)
    return res
      .status(500)
      .json({ success: false, error: (err as Error).message })
  }
