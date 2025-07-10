// pages/api/markets/active.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const markets = await prisma.market.findMany({
      where: {
        status: 'active', // ✅ use only valid schema fields
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 30,
    });

    // ✅ Convert Date objects to strings
    const serializedMarkets = markets.map((m) => ({
      ...m,
      eventTime: m.eventTime?.toISOString() ?? null,
      createdAt: m.createdAt?.toISOString() ?? null,
      updatedAt: m.updatedAt?.toISOString() ?? null,
    }));

    return res.status(200).json({ markets: serializedMarkets });
  } catch (error) {
    console.error('/api/markets/active error:', error);
    return res.status(500).json({ error: 'Internal server error', markets: [] });
  }
}
