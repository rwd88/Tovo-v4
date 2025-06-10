// pages/api/trade.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { calculateShares } from '../../../lib/cpmm';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { marketId, userId, type, amount } = req.body;

    // Validate input
    if (!marketId || !userId || !type || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    if (!['yes', 'no'].includes(type)) {
      return res.status(400).json({ error: 'Invalid trade type' });
    }

    // Get market data
    const market = await prisma.market.findUnique({
      where: { id: marketId },
      select: { poolYes: true, poolNo: true, status: true }
    });

    if (!market || market.status !== 'open') {
      return res.status(400).json({ error: 'Market not available for trading' });
    }

    // Calculate fee and shares
    const fee = amount * 0.01; // 1% fee
    const shares = calculateShares(amount, market.poolYes, market.poolNo, type);
    const payout = shares * (type === 'yes' ? market.poolYes / market.poolNo : market.poolNo / market.poolYes);

    // Create trade in a transaction
    const [trade, updatedMarket] = await prisma.$transaction([
      prisma.trade.create({
        data: {
          marketId,
          userId,
          type,
          amount,
          fee,
          payout,
          shares, // Make sure this is included
          settled: false
        }
      }),
      prisma.market.update({
        where: { id: marketId },
        data: {
          poolYes: type === 'yes' ? { increment: amount } : undefined,
          poolNo: type === 'no' ? { increment: amount } : undefined
        }
      })
    ]);

    return res.status(200).json({
      success: true,
      trade,
      updatedMarket
    });

  } catch (error) {
    console.error('Trade error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : undefined
    });
  }
}