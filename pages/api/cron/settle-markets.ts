// pages/api/cron/settle-markets.ts
import { prisma } from '../../../lib/prisma';
import { sendCronSummary } from '../../../lib/telegram';

export default async function handler() {
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

  let totalHouseProfit = 0;
  
  // 2. Process each market
  for (const market of markets) {
    const totalPool = market.poolYes + market.poolNo;
    const winningSide = market.outcome === 'YES' ? 'poolYes' : 'poolNo';
    
    // Economic calculations
    const houseCut = totalPool * 0.1; // 10% house fee
    const tradingFee = totalPool * 0.01; // 1% per trade
    const netPool = totalPool - houseCut - (tradingFee * 2);
    
    // 3. Update trader balances
    const winningTrades = market.trades.filter(t => t.side === winningSide);
    const winningShare = market[winningSide] / netPool;
    
    await prisma.$transaction([
      ...winningTrades.map(trade => 
        prisma.user.update({
          where: { id: trade.userId },
          data: { balance: { increment: trade.amount * winningShare } }
        })
      ),
      prisma.market.update({
        where: { id: market.id },
        data: { status: 'settled' }
      })
    ]);
    
    totalHouseProfit += houseCut;
  }

  // 4. Notify results
  await sendCronSummary(
    `🏦 Settlement Complete\n` +
    `• Markets: ${markets.length}\n` +
    `• House Profit: $${totalHouseProfit.toFixed(2)}\n` +
    `⌛ Next: ${new Date(Date.now() + 86400000).toLocaleTimeString()}`
  );

  return { success: true };
}