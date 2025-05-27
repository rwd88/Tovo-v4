// pages/api/cron/settle-markets.ts
import { prisma } from '../../../lib/prisma';
import { sendCronSummary, sendAdminAlert } from '../../../lib/telegram';

// Increase timeout for Vercel (requires Pro plan)
export const config = {
  maxDuration: 60, // 60 seconds (Hobby plan max)
};

export default async function handler() {
  try {
    console.log('⏳ Starting market settlement process...');
    
    // 1. Find markets ready for settlement in batches
    const batchSize = 20; // Process 20 markets at a time
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
          trades: {
            where: {
              settled: false // Only process unsettled trades
            }
          }
        },
        skip,
        take: batchSize,
        orderBy: {
          eventTime: 'asc' // Process oldest first
        }
      });

      if (markets.length === 0) {
        hasMoreMarkets = false;
        break;
      }

      console.log(`Processing batch of ${markets.length} markets...`);

      // 2. Process each market in parallel with error handling
      const batchResults = await Promise.allSettled(
        markets.map(async (market) => {
          try {
            const winningOutcome = market.outcome!.toUpperCase() as 'YES' | 'NO';
            const winningPool = winningOutcome === 'YES' ? market.poolYes : market.poolNo;
            const winningTrades = market.trades.filter(t => t.type === winningOutcome);

            // Skip if no winning trades to process
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
            const profitShare = netPool / winningPool;

            // Process trades in sub-batches
            const tradeBatchSize = 50;
            for (let i = 0; i < winningTrades.length; i += tradeBatchSize) {
              const tradeBatch = winningTrades.slice(i, i + tradeBatchSize);
              
              await prisma.$transaction([
                ...tradeBatch.map(trade =>
                  prisma.user.update({
                    where: { id: trade.userId },
                    data: { 
                      balance: { 
                        increment: trade.amount * profitShare - trade.fee
                      } 
                    }
                  })
                ),
                prisma.trade.updateMany({
                  where: { 
                    id: { in: tradeBatch.map(t => t.id) }
                  },
                  data: { settled: true }
                })
              ]);
            }

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

      // 3. Count successful settlements
      const successfulSettlements = batchResults.filter(r => 
        r.status === 'fulfilled' && r.value.success
      );
      
      totalSettled += successfulSettlements.length;
      totalProfit += successfulSettlements.reduce(
        (sum, r) => sum + (r.status === 'fulfilled' ? r.value.profit : 0), 0
      );

      skip += batchSize;
    }

    // 4. Final reporting
    console.log(`✔ Successfully settled ${totalSettled} markets`);
    await sendCronSummary(
      `🏦 Settlement Complete\n` +
      `• Markets: ${totalSettled} settled\n` +
      `• House Profit: $${totalProfit.toFixed(2)}\n` +
      `⌛ Next: ${new Date(Date.now() + 86400000).toLocaleTimeString()}`
    );

    return { 
      success: true, 
      totalSettled,
      totalProfit 
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Settlement process failed:', error);
    await sendAdminAlert(`🚨 Settlement Failed: ${errorMessage}`);
    
    return {
      success: false,
      error: errorMessage
    };
  }
}