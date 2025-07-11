// pages/api/debug/add-market.ts
import { prisma } from '../../../lib/prisma';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const market = await prisma.market.create({
      data: {
        id: 'test-market-001',
        question: 'Will BTC hit $70K this week?',
        status: 'open',
        eventTime: new Date(Date.now() + 86400000), // tomorrow
        forecast: 0,
resolvedOutcome: { not: null },
        externalId: 'manual-test-001',
        poolYes: 0,
        poolNo: 0,
      }
    });

    res.status(200).json({ success: true, marketId: market.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Could not create market' });
  }
}
