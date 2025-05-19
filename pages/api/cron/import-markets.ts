// File: pages/api/cron/import-markets.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'
import { prisma } from '../../../lib/prisma'

interface ApiResponse {
  success: boolean
  tradesDeleted?: number
  marketsDeleted?: number
  added?: number
  error?: string
}

// shape of the Faireconomy JSON feed
interface FFEvent {
  title: string
  impact: 0 | 1 | 2 | 3
  date: string       // e.g. "2025-05-19T13:30:00Z"
  forecast: string    // e.g. "3.5"
}

interface FFCalendar {
  events: FFEvent[]
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // 0) secret
  const auth = req.headers.authorization
  if (!process.env.CRON_SECRET) {
    return res
      .status(500)
      .json({ success: false, error: 'CRON_SECRET not configured' })
  }
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(403).json({ success: false, error: 'Unauthorized' })
  }

  // 1) GET only
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Only GET allowed' })
  }

  try {
    // 2) delete old data
    const tradesDel = await prisma.trade.deleteMany({})
    const marketsDel = await prisma.market.deleteMany({})

    // 3) fetch the JSON calendar
    const JSON_URL = 'https://cdn.faireconomy.media/ff_calendar_thisweek.json'
    const { data: feed } = await axios.get<FFCalendar>(JSON_URL, {
      responseType: 'json',
    })

    // 4) filter only high-impact (impact===3)
    const high = feed.events.filter((e) => e.impact === 3)

    // 5) map to your prisma shape
    const toCreate = high.map((e) => ({
      question: e.title,
      status: 'open' as const,
      eventTime: new Date(e.date).toISOString(),
      forecast: parseFloat(e.forecast) || 0,
      outcome: null as null,
      poolYes: 0,
      poolNo: 0,
    }))

    // 6) bulk-insert in chunks of 100
    let added = 0
    for (let i = 0; i < toCreate.length; i += 100) {
      const chunk = toCreate.slice(i, i + 100)
      const { count } = await prisma.market.createMany({ data: chunk })
      added += count
    }

    // 7) respond
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
}
