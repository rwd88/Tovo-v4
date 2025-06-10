// pages/api/markets.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Only GET allowed' });
  }

  try {
    const now = new Date();
    const markets = await prisma.market.findMany({
      where: {
        status: 'open',
        eventTime: { gt: now },       // only future events
      },
      orderBy: { eventTime: 'asc' },
      select: {
        id: true,
        externalId: true,
        question: true,
        eventTime: true,
        poolYes: true,
        poolNo: true,
      }
    });

    return res.status(200).json(markets);
  } catch (err) {
    console.error('[/api/markets] error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
