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

interface FFEvent {
  title: string
  impact: 0 | 1 | 2 | 3
  date: string
  forecast: string
}
interface FFCalendar {
  events: FFEvent[]
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // 0) secret check
  const auth = req.headers.authorization
  if (!process.env.CRON_SECRET) {
    return res
      .status(500)
      .json({ success: false, error: 'CRON_SECRET not configured' })
  }
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(403).json({ success: false, error: 'Unauthorized' })
  }

  // 1) enforce GET
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Only GET allowed' })
  }

  try {
    // 2) delete old data
    const tradesDel = await prisma.trade.deleteMany({})
    const marketsDel = await prisma.market.deleteMany({})

    // 3) fetch JSON calendar from the NFS host
    const JSON_URL =
      'https://cdn-nfs.faireconomy.media/ff_calendar_thisweek.json'
    const { data: feed } = await axios.get<FFCalendar>(JSON_URL)

    // 4) filter high impact only
    const high = feed.events.filter((e) => e.impact === 3)

    // 5) map into your schema
    const toCreate = high.map((e) => ({
      question: e.title,
      status: 'open' as const,
      eventTime: new Date(e.date).toISOString(),
      forecast: parseFloat(e.forecast) || 0,
      outcome: null as null,
      poolYes: 0,
      poolNo: 0,
    }))

    // 6) bulk‐insert in batches of 100
    let added = 0
    for (let i = 0; i < toCreate.length; i += 100) {
      const chunk = toCreate.slice(i, i + 100)
      const { count } = await prisma.market.createMany({ data: chunk })
      added += count
    }

    // 7) success response
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
