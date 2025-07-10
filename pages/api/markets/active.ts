// /pages/api/markets/active.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const markets = await prisma.market.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        externalId: true,
        question: true,
        eventTime: true,
        poolYes: true,
        poolNo: true,
      },
    });

    // Fix serialization (convert Date to string)
    const safeMarkets = markets.map((m) => ({
      ...m,
      eventTime: m.eventTime.toISOString(),
    }));

    return res.status(200).json(safeMarkets);
  } catch (error) {
    console.error('/api/markets/active error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
