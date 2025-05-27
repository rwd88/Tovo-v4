// pages/api/markets.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../lib/prisma'

interface Market {
  id: string
  question: string
  eventTime: Date
  poolYes: number
  poolNo: number
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Market[] | { error: string }>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ 
      error: 'Method Not Allowed. Only GET requests are supported.' 
    })
  }

  try {
    const markets = await prisma.market.findMany({
      where: { 
        status: 'open',
        eventTime: {
          gte: new Date() // Only include future markets
        }
      },
      orderBy: { 
        eventTime: 'asc' 
      },
      select: {
        id: true,
        question: true,
        eventTime: true,
        poolYes: true,
        poolNo: true,
      },
    })

    return res.status(200).json(markets)
  } catch (err) {
    console.error('Failed to fetch markets:', err)
    return res.status(500).json({ 
      error: 'Internal Server Error: Failed to fetch markets data' 
    })
  }
}