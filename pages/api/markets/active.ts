// pages/api/markets/active.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'

export type ActiveMarket = {
  id: string
  question: string
  eventTime: string  // ISO timestamp
  poolYes: number
  poolNo: number
  houseProfit: number | null
  tag: string | null
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ActiveMarket[] | { error: string }>
) {
  // ① Only allow GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` })
  }

  try {
    const skip = parseInt((req.query.skip as string) ?? '0', 10)
    const take = 10

    // ② Pure DB fetch — NO Telegram calls here!
    const markets = await prisma.market.findMany({
      where: { status: 'open' },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      select: {
        id: true,
        question: true,
        eventTime: true,
        poolYes: true,
        poolNo: true,
        houseProfit: true,
        tag: true,
      },
    })

    // ③ Serialize dates for JSON
    const payload: ActiveMarket[] = markets.map((m) => ({
      id: m.id,
      question: m.question,
      eventTime: m.eventTime.toISOString(),
      poolYes: m.poolYes,
      poolNo: m.poolNo,
      houseProfit: m.houseProfit,
      tag: m.tag,
    }))

    return res.status(200).json(payload)
  } catch (err) {
    console.error('[/api/markets/active] Error loading active markets:', err)
    return res.status(500).json({ error: 'Failed to load active markets' })
  }
}
