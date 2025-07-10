import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const markets = await prisma.market.findMany({
      where: { resolved: false },
      select: {
        id: true,
        externalId: true,
        question: true,
        eventTime: true,
        poolYes: true,
        poolNo: true,
      },
    });

    const serialized = markets.map((m) => ({
      ...m,
      eventTime: m.eventTime.toISOString(), // 🔥 Fix: serialize Date
    }));

    return res.status(200).json(serialized);
  } catch (error) {
    console.error('[API /markets/active] error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
