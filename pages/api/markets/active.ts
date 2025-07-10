import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

type Market = {
  id: string
  externalId: string | null
  question: string
  eventTime: string
  poolYes: number
  poolNo: number
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Market[] | { message: string }>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` })
  }

  try {
    // adjust the `where` clause to match your schema (e.g. `settled: false`, `open: true`, etc.)
    const markets = await prisma.market.findMany({
      where: {
        eventTime: { gt: new Date() },
        // settled: false, 
      },
      select: {
        id: true,
        externalId: true,
        question: true,
        eventTime: true,
        poolYes: true,
        poolNo: true,
      },
      orderBy: { eventTime: 'asc' },
    })

    return res.status(200).json(markets)
  } catch (error) {
    console.error('[/api/markets/active] error:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}
