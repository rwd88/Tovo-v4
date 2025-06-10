// pages/api/debug-markets.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const allMarkets = await prisma.market.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json(allMarkets);
  } catch (err) {
    console.error('[/api/debug-markets] error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
