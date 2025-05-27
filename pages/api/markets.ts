// pages/api/markets.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../lib/prisma'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Only GET method is allowed on this endpoint.' })
  }

  try {
    const markets = await prisma.market.findMany({
      where: { status: 'open' },
      orderBy: { eventTime: 'asc' },
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
    console.error('api/markets error', err)
    return res.status(500).json({ error: 'Could not fetch markets' })
  }
}
