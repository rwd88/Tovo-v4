// pages/api/admin/trades.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../lib/prisma'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Only GET allowed' })
  }

  try {
    // Fetch all trades, optionally include market data
    const trades = await prisma.trade.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        market: {
          select: {
            id: true,
            question: true,
            externalId: true,
            eventTime: true,
          },
        },
      },
    })

    return res.status(200).json({ success: true, trades })
  } catch (err) {
    console.error('[/api/admin/trades] error:', err)
    return res.status(500).json({ success: false, error: 'Server error' })
  } finally {
    await prisma.$disconnect()
  }
}
