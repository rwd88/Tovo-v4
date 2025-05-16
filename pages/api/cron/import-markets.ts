// File: pages/api/cron/import-markets.ts
/* eslint-disable */
import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'
import { DateTime } from 'luxon'
import { prisma } from '../../../lib/prisma'

interface FFEvent {
  id: string
  time: string       // e.g. "2025-05-16T08:30:00Z"
  impact: 1 | 2 | 3
  event: string      // the name/question
  forecast: number | null
  // …you can add other fields here if you like
}

type Success = {
  success: true
  tradesDeleted: number
  marketsDeleted: number
  added: number
}

type Failure = {
  success: false
  error: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Success | Failure>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Only GET allowed' })
  }
  console.log('⏳ import-markets cron start')

  try {
    // 1) Wipe out yesterday’s trades & markets
    const tradesDel = await prisma.trade.deleteMany({})
    const marketsDel = await prisma.market.deleteMany({})
    console.log(`✔ Trades deleted: ${tradesDel.count}`)
    console.log(`✔ Markets deleted: ${marketsDel.count}`)

    // 2) Fetch the JSON feed (high-impact events are impact===3)
    const JSON_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json'
    console.log(`→ Fetching JSON feed from ${JSON_URL}`)
    const { data: events } = await axios.get<FFEvent[]>(JSON_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    console.log(`✔ Total events in feed: ${events.length}`)

    // 3) Keep only the 3-impact (red) events
    const highImpact = events.filter((e) => e.impact === 3)
    console.log(`→ High-impact events: ${highImpact.length}`)

    // 4) Map to your Market record shape
    const toCreate = highImpact.map((e) => {
      // Parse event.time (ISO) into a JS Date for Prisma
      const iso = DateTime.fromISO(e.time, { zone: 'UTC' }).toISO()
      return {
        question: e.event,
        status: 'open' as const,
        eventTime: iso!,
        forecast: e.forecast ?? 0,
        outcome: null as string | null,
        poolYes: 0,
        poolNo: 0,
      }
    })

    // 5) Bulk insert in 100-item chunks
    let added = 0
    for (let i = 0; i < toCreate.length; i += 100) {
      const chunk = toCreate.slice(i, i + 100)
      const result = await prisma.market.createMany({ data: chunk })
      added += result.count
    }
    console.log(`✔ Markets created: ${added}`)

    // 6) Done
    return res.status(200).json({
      success: true,
      tradesDeleted: tradesDel.count,
      marketsDeleted: marketsDel.count,
      added,
    })
  } catch (unknownErr) {
    console.error('🔥 import-markets cron failed:', unknownErr)
    const error =
      unknownErr instanceof Error ? unknownErr.message : 'Unknown error'
    return res.status(500).json({ success: false, error })
  }
}
