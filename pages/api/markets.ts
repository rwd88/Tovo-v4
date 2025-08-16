import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../lib/prisma'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Only GET allowed' })
  }

  try {
    // Avoid caching to prevent stale lists
    res.setHeader('Cache-Control', 'no-store')

    // current UTC time
    const now = new Date()

    // Only future, unresolved, open markets
    const markets = await prisma.market.findMany({
      where: {
        status: 'open',
        resolvedOutcome: null,
        eventTime: { gt: now },
      },
      orderBy: { eventTime: 'asc' },
      select: {
        id: true,
        externalId: true,
        question: true,
        eventTime: true,
        poolYes: true,
        poolNo: true,
        status: true,
        tag: true,             // include tag (frontend uses it)
      },
    })

    return res.status(200).json(markets)
  } catch (err) {
    console.error('[/api/markets] error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
}
