// pages/api/markets/active.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import  prisma  from '../../../lib/prisma'

export type ActiveMarket = {
  id: string
  question: string
  eventTime: string   // ISO
  poolYes: number
  poolNo: number
  houseProfit: number | null
  tag: string | null
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ActiveMarket[] | { error: string }>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` })
  }

  try {
    // Avoid stale lists
    res.setHeader('Cache-Control', 'no-store')

    const now = new Date() // UTC
    const skip = Number.parseInt((req.query.skip as string) ?? '0', 10)
    const take =
      Number.isFinite(Number(req.query.take)) && Number(req.query.take) > 0
        ? Math.min(Number(req.query.take), 50)
        : 20

    const markets = await prisma.market.findMany({
      where: {
        status: { in: ['open', 'OPEN'] }, // tolerate case
        resolved: false,
        resolvedOutcome: null,
        eventTime: { gt: now },           // ✅ only future events
      },
      orderBy: { eventTime: 'asc' },      // soonest first
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
    console.error('[/api/markets/active] Error:', err)
    return res.status(500).json({ error: 'Failed to load active markets' })
  }
}
