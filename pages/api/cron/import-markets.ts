/* eslint-disable */
// File: pages/api/cron/import-markets.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'
import { prisma } from '../../../lib/prisma'

interface FFEvent {
  id: number
  currency: string
  impact: 'low' | 'medium' | 'high'
  event: string
  timestamp: number  // seconds since epoch
  forecast: number | null
  actual: number | null
  previous: number | null
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Only GET allowed' })
  }

  console.log('⏳ import-markets cron start')

  try {
    // 1) Wipe out yesterday’s trades & markets
    const tradesDel  = await prisma.trade.deleteMany({})
    const marketsDel = await prisma.market.deleteMany({})
    console.log(`✔ Deleted trades=${tradesDel.count}, markets=${marketsDel.count}`)

    // 2) Fetch the public JSON feed
    const JSON_URL = 'https://cdn.faireconomy.media/ff_calendar_thisweek.json'
    console.log(`→ Fetching JSON feed from ${JSON_URL}`)
    const { data: events } = await axios.get<FFEvent[]>(JSON_URL)
    console.log(`✔ JSON events fetched: ${events.length}`)

    // 3) Filter only “high” impact events
    const highImpact = events.filter((e) => e.impact === 'high')
    console.log(`→ High-impact events: ${highImpact.length}`)

    // 4) Map to your Market shape
    const toCreate = highImpact.map((e) => ({
      question: e.event,
      status:  'open' as const,
      eventTime: new Date(e.timestamp * 1_000).toISOString(),
      forecast:  e.forecast ?? 0,
      outcome:   e.actual  === null ? null : String(e.actual),
      poolYes:   0,
      poolNo:    0,
    }))

    // 5) Bulk insert
    const { count: added } = await prisma.market.createMany({
      data: toCreate,
    })
    console.log(`✔ Markets created: ${added}`)

    // 6) Return summary
    return res.status(200).json({
      success:        true,
      tradesDeleted:  tradesDel.count,
      marketsDeleted: marketsDel.count,
      added,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('🔥 import-markets cron failed:', msg)
    return res.status(500).json({ success: false, error: msg })
  }
}
