// File: pages/api/markets/active.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export type ActiveMarket = {
  id: string
  question: string
  eventTime: Date
  poolYes: number
  poolNo: number
  houseProfit: number | null
  tag: string | null
}

interface ActiveResponse {
  success: boolean
  markets?: ActiveMarket[]
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ActiveResponse>
) {
  if (req.method !== 'GET') {
    return res
      .status(405)
      .json({ success: false, error: 'Only GET allowed' })
  }

  try {
    const markets = await prisma.market.findMany({
      where: { status: 'open' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        question: true,
        eventTime: true,
        poolYes: true,
        poolNo: true,
        houseProfit: true,
        tag: true,
      },
      take: 20,    // page size
      skip: 0,     // for pagination, bump this by 20 for page 2, etc.
    })

    return res.status(200).json({ success: true, markets })
  } catch (err) {
    console.error('❌ /api/markets/active error:', err)
    return res
      .status(500)
      .json({ success: false, error: 'Unable to load markets' })
  }
}
