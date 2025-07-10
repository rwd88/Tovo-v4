// pages/api/markets/active.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Only GET allowed' });
  }

  try {
    const now = new Date();

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
        tag: true,
      },
    });

    const formatted = markets.map((market) => {
      const timeDiffMs = new Date(market.eventTime).getTime() - now.getTime();
      const timeDiffSec = Math.floor(timeDiffMs / 1000);

      const days = Math.floor(timeDiffSec / (3600 * 24));
      const hours = Math.floor((timeDiffSec % (3600 * 24)) / 3600);
      const endsIn = `⏳ Ends in ${days} day${days !== 1 ? 's' : ''} ${hours} hour${hours !== 1 ? 's' : ''}`;

      return {
        ...market,
        endsIn,
      };
    });

    return res.status(200).json({ success: true, markets: formatted });
  } catch (err) {
    console.error('[/api/markets/active] error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
