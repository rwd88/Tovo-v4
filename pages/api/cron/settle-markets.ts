// pages/api/cron/settle-markets.ts
import { prisma } from '../../../lib/prisma';
import { sendCronSummary, sendAdminAlert } from '../../../lib/telegram';

export default async function handler() {
  try {
    // 1. Find markets ready for settlement
    const markets = await prisma.market.findMany({
      where: {
        eventTime: { lt: new Date() },
        outcome: { not: null },
        status: 'open'
      },
      include: {
        trades: true
      }
    });

    let totalSettled = 0;
    let totalProfit = 0;

    // 2. Process each market
    for (const market of markets) {
      // Determine winning outcome (YES/NO from ForexFactory XML)
      const winningOutcome = market.outcome!.toUpperCase() as 'YES' | 'NO';
      
      // Get corresponding pool and trades
      const winningPool = winningOutcome === 'YES' ? market.poolYes : market.poolNo;
      // const losingPool = winningOutcome === 'YES' ? market.poolNo : market.poolYes;  // <-- Removed
      const winningTrades = market.trades.filter(t => t.type === winningOutcome);

      // Economic calculations
      const totalPool = market.poolYes + market.poolNo;
      const tradingFee = totalPool * 0.01 * 2; // 1% from both sides
      const houseCut = totalPool * 0.1; // 10% house fee
      const netPool = totalPool - tradingFee - houseCut;

      // Calculate profit share per winning trade
      const profitShare = netPool / winningPool;

      // Prepare balance updates
      const updates = winningTrades.map(trade => 
        prisma.user.update({
          where: { id: trade.userId },
          data: { 
            balance: { 
              increment: trade.amount * profitShare - trade.fee
            } 
          }
        })
      );

      // Execute transaction
      await prisma.$transaction([
        ...updates,
        prisma.market.update({
          where: { id: market.id },
          data: { status: 'settled' }
        })
      ]);

      totalSettled++;
      totalProfit += houseCut;
    }

    // 3. Notify results
    await sendCronSummary(
      `✅ Settled ${totalSettled} markets\n` +
      `🏦 House profit: $${totalProfit.toFixed(2)}`
    );

    return { success: true, totalSettled };

  } catch (error) {
  let message = "Unknown error";
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  }
  await sendAdminAlert(`🔥 Settlement failed: ${message}`);
  throw error;
}
}
