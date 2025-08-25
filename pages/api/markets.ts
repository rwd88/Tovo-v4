// pages/api/markets.ts 
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../lib/prisma'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Only GET allowed' });
  }

  try {
    // current UTC time
    const now = new Date();

    // only open markets with eventTime in the future
    const markets = await prisma.market.findMany({
      where: {
        status: 'open',
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
        status: true,  // ✅ Required by frontend
      },
    });

    return res.status(200).json(markets);
  } catch (err) {
    console.error('[/api/markets] error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}