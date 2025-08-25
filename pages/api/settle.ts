// pages/api/settle-markets.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../lib/prisma'

interface SettlementResult {
  success: boolean
  settledMarkets?: number
  error?: string
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
        eventTime: { lt: new Date() }, // already passed
      },
      include: { trades: true },
    })

    // 2. Process each market
    for (const market of marketsToSettle) {
      // Determine YES/NO outcome however you wish
      const outcome = determineOutcome(market) // 'YES' or 'NO'

      // Build all trade‐updates
      const updateTrades = market.trades.map((trade) =>
        prisma.trade.update({
          where: { id: trade.id },
          data: {
            settled: true,
            // mark winning trades' payout, losers get zero
            payout:
              trade.type.toUpperCase() === outcome
                ? calculatePayout(trade, market)
                : 0,
          },
        })
      )

      // 3. In one transaction: update market + all its trades
      await prisma.$transaction([
        prisma.market.update({
          where: { id: market.id },
          data: {
            status:          'settled',        // mark it settled
            resolved:        true,             // optional boolean
            resolvedOutcome: outcome,          // your YES/NO
          },
        }),
        ...updateTrades,
      ])
    }

    return res.status(200).json({
      success:        true,
      settledMarkets: marketsToSettle.length,
    })
  } catch (err) {
    console.error('Settlement failed:', err)
    return res.status(500).json({
      success: false,
      error:   'Internal server error',
    })
  }
}

// your outcome logic
function determineOutcome(market: MarketWithTrades): 'YES' | 'NO' {
  return market.poolYes > market.poolNo ? 'YES' : 'NO'
}

// example payout calculation
function calculatePayout(
  trade: Trade,
  market: MarketWithTrades
): number {
  const winPool      = market.poolYes
  const losePool     = market.poolNo
  const totalPool    = winPool + losePool
  const shareFactor  = winPool > 0 ? totalPool / winPool : 0
  // simple: return trade.amount * shareFactor
  return trade.amount * shareFactor
}

// Types (you can import these instead)
type MarketWithTrades = {
  id:        string
  poolYes:   number
  poolNo:    number
  status:    string
  eventTime: Date
  trades:    Trade[]
}
type Trade = { id: string; type: string; amount: number }
