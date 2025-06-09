// pages/api/settle.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    // Example settlement logic - replace with your actual implementation
    const unsettledMarkets = await prisma.market.findMany({
      where: { 
        status: 'open',
        eventTime: { lt: new Date() } // Markets where event time has passed
      },
      include: {
        trades: true
      }
    });

    for (const market of unsettledMarkets) {
      // Determine outcome (replace with your actual logic)
      const outcome = market.poolYes > market.poolNo ? 'YES' : 'NO';

      await prisma.$transaction([
        // Update market status
        prisma.market.update({
          where: { id: market.id },
          data: { status: 'settled', outcome }
        }),
        // Update all trades with payouts
        ...market.trades.map(trade => 
          prisma.trade.update({
            where: { id: trade.id },
            data: { 
              settled: true,
              payout: trade.type === outcome ? 
                trade.amount * (1 + (trade.type === 'YES' ? 
                  market.poolNo / market.poolYes : 
                  market.poolYes / market.poolNo)) : 
                0
            }
          })
        )
      ]);
    }

    return res.status(200).json({ 
      success: true,
      settledMarkets: unsettledMarkets.length 
    });
  } catch (err) {
    console.error('Settlement error:', err);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to settle markets' 
    });
  }
}