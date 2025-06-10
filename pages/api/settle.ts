import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

interface SettlementResult {
  success: boolean;
  settledMarkets?: number;
  error?: string;
}

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse<SettlementResult>
) {
  try {
    // 1. Find markets ready for settlement
    const marketsToSettle = await prisma.market.findMany({
      where: {
        status: 'open',
        eventTime: { lt: new Date() } // Past their event time
      },
      include: {
        trades: true
      }
    });

    // 2. Process each market
    for (const market of marketsToSettle) {
      const outcome = determineOutcome(market); // Your logic here
      const updatePromises = market.trades.map(trade => 
        updateTradeSettlement(trade, outcome, market)
      );

      await prisma.$transaction([
        prisma.market.update({
          where: { id: market.id },
          data: { status: 'settled', outcome }
        }),
        ...updatePromises
      ]);
    }

    return res.status(200).json({
      success: true,
      settledMarkets: marketsToSettle.length
    });

  } catch (err) {
    console.error('Settlement failed:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

// Helper functions
function determineOutcome(market: MarketWithTrades): 'YES' | 'NO' {
  // Implement your actual outcome logic
  return market.poolYes > market.poolNo ? 'YES' : 'NO';
}

function updateTradeSettlement(trade: Trade, outcome: string, market: Market) {
  const isWinningTrade = trade.type === outcome;
  return prisma.trade.update({
    where: { id: trade.id },
    data: {
      settled: true,
      payout: isWinningTrade ? calculatePayout(trade, market) : 0
    }
  });
}

function calculatePayout(trade: Trade, market: Market): number {
  // Implement your payout calculation
  const pool = trade.type === 'YES' ? market.poolYes : market.poolNo;
  const oppositePool = trade.type === 'YES' ? market.poolNo : market.poolYes;
  return trade.amount * (1 + (oppositePool / pool));
}

// Types
type MarketWithTrades = Market & { trades: Trade[] };
type Trade = {
  id: string;
  type: string;
  amount: number;
  // ... other trade fields
};
type Market = {
  id: string;
  poolYes: number;
  poolNo: number;
  // ... other market fields
};