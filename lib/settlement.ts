import { prisma } from './prisma'

/**
 * Settles a market by determining the winning outcome and updating user trades
 * @param marketId The ID of the market to settle
 * @returns The winning outcome or null if not settled
 */
export async function settleMarket(marketId: string) {
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    include: {
      outcomes: {
        include: { trades: true },
      },
    },
  })

  if (!market) throw new Error('Market not found')
  if (market.status !== 'open') throw new Error('Market is not open')

  // Find outcome with most volume
  let winningOutcome = null
  let maxVolume = -1

  for (const outcome of market.outcomes) {
    const volume = outcome.trades.reduce((sum, trade) => sum + trade.shares, 0)
    if (volume > maxVolume) {
      maxVolume = volume
      winningOutcome = outcome
    }
  }

  if (!winningOutcome) throw new Error('No trades found to settle the market')

  // Update market status to "settled"
  await prisma.market.update({
    where: { id: marketId },
    data: {
      status: 'settled',
      settledAt: new Date(),
      outcome: winningOutcome.name,
    },
  })

  // Mark winning trades
  await prisma.trade.updateMany({
    where: {
      marketId,
      outcomeId: winningOutcome.id,
    },
    data: { won: true },
  })

  // Mark losing trades
  await prisma.trade.updateMany({
    where: {
      marketId,
      outcomeId: { not: winningOutcome.id },
    },
    data: { won: false },
  })

  return winningOutcome.name
}
