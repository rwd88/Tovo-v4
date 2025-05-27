// pages/api/cron/settle-markets.ts
import { prisma } from '../../../lib/prisma';
import { sendCronSummary, sendAdminAlert } from '../../../lib/telegram';

export const config = {
  maxDuration: 60,
};

import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    console.log('⏳ Starting market settlement process...');

    const batchSize = 20;
    let totalSettled = 0;
    let totalProfit = 0;
    let hasMoreMarkets = true;
    let skip = 0;

    while (hasMoreMarkets) {
      const markets = await prisma.market.findMany({
        where: {
          eventTime: { lt: new Date() },
          outcome: { not: null },
          status: 'open'
        },
        include: {
          trades: true, // Don't filter by 'settled'
        },
        skip,
        take: batchSize,
        orderBy: {
          eventTime: 'asc'
        }
      });

      if (markets.length === 0) {
        hasMoreMarkets = false;
        break;
      }

      console.log(`Processing batch of ${markets.length} markets...`);

      // Process each market in parallel
      const batchResults = await Promise.allSettled(
        markets.map(async (market) => {
          try {
            // Make sure outcome exists and is string
            const winningOutcome = (market.outcome ?? '').toString().toUpperCase();
            if (!['YES', 'NO'].includes(winningOutcome)) {
              // Mark as settled and skip
              await prisma.market.update({
                where: { id: market.id },
                data: { status: 'settled' }
              });
              return { success: true, profit: 0 };
            }

            const winningPool = winningOutcome === 'YES' ? market.poolYes : market.poolNo;
            const winningTrades = market.trades.filter(t => t.type?.toUpperCase() === winningOutcome);

            // If no winning trades, just settle the market
            if (winningTrades.length === 0) {
              await prisma.market.update({
                where: { id: market.id },
                data: { status: 'settled' }
              });
              return { success: true, profit: 0 };
            }

            const totalPool = market.poolYes + market.poolNo;
            const tradingFee = totalPool * 0.01 * 2;
            const houseCut = totalPool * 0.1;
            const netPool = totalPool - tradingFee - houseCut;
            const profitShare = winningPool > 0 ? netPool / winningPool : 0;

            // Update user balances in batches (if needed)
            const tradeBatchSize = 50;
            for (let i = 0; i < winningTrades.length; i += tradeBatchSize) {
              const tradeBatch = winningTrades.slice(i, i + tradeBatchSize);

              await prisma.$transaction([
                ...tradeBatch.map(trade =>
                  prisma.user.update({
                    where: { id: trade.userId },
                    data: {
                      balance: {
                        increment: trade.amount * profitShare - (trade.fee ?? 0)
                      }
                    }
                  })
                )
              ]);
            }

            // Mark market as settled
            await prisma.market.update({
              where: { id: market.id },
              data: { status: 'settled' }
            });

            return { success: true, profit: houseCut };
          } catch (marketError) {
            console.error(`Failed to settle market ${market.id}:`, marketError);
            return { success: false, profit: 0 };
          }
        })
      );

      // Count successes and profits
      const successfulSettlements = batchResults.filter(r =>
        r.status === 'fulfilled' && r.value && r.value.success
      );
      totalSettled += successfulSettlements.length;
      totalProfit += successfulSettlements.reduce(
        (sum, r) => sum + (r.status === 'fulfilled' ? r.value.profit : 0), 0
      );

      skip += batchSize;
    }

    // Final reporting
    console.log(`✔ Successfully settled ${totalSettled} markets`);
    await sendCronSummary(
      `🏦 Settlement Complete\n` +
      `• Markets: ${totalSettled} settled\n` +
      `• House Profit: $${totalProfit.toFixed(2)}\n` +
      `⌛ Next: ${new Date(Date.now() + 86400000).toLocaleTimeString()}`
    );

    return res.status(200).json({
      success: true,
      totalSettled,
      totalProfit
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Settlement process failed:', error);
    await sendAdminAlert(`🚨 Settlement Failed: ${errorMessage}`);
    return res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
}
