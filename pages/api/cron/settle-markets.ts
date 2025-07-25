// pages/api/cron/settle-markets.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { determineMarketResult } from '../../../lib/market-utils'
import { sendAdminNotification } from '../../../lib/telegram'

export const config = {
  api: { bodyParser: false },
  maxDuration: 90, // Increased timeout for large batches
}

interface SettlementResult {
  success: boolean
  settledCount?: number
  houseProfit?: number
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SettlementResult>
) {
  // Enhanced authentication
  const authMethods = [
    req.query.secret,
    req.headers.authorization?.replace('Bearer ', ''),
    req.headers['x-cron-secret']
  ].filter(Boolean)

  if (!authMethods.includes(process.env.CRON_SECRET!)) {
    console.warn('Unauthorized settlement attempt', {
      ip: req.headers['x-forwarded-for'],
      time: new Date().toISOString()
    })
    return res.status(403).json({ 
      success: false, 
      error: 'Invalid credentials' 
    })
  }

  try {
    console.log('🚀 Starting market settlement batch')
    const BATCH_SIZE = 25 // Optimal for most databases
    let totalSettled = 0
    let totalProfit = 0
    let hasMore = true

    while (hasMore) {
      const markets = await prisma.market.findMany({
        where: {
          status: 'open',
          eventTime: { lt: new Date() },
          resolvedOutcome: { not: null }
        },
        include: {
          trades: {
            where: { settled: false },
            select: { id: true, userId: true, type: true, amount: true }
          }
        },
        take: BATCH_SIZE,
        orderBy: { eventTime: 'asc' }
      })

      if (markets.length === 0) {
        hasMore = false
        break
      }

      // Process markets in parallel with error handling
      const batchResults = await Promise.allSettled(
        markets.map(market => settleSingleMarket(market))
      )

      // Aggregate results
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          totalSettled += result.value.settled ? 1 : 0
          totalProfit += result.value.profit || 0
        } else {
          console.error('Market settlement failed:', result.reason)
          await sendAdminNotification(
            `⚠️ Failed to settle market: ${result.reason.message}`
          )
        }
      }
    }

    // Final report
    await sendAdminNotification(
      `🏦 Settlement Complete\n` +
      `• Markets: ${totalSettled}\n` +
      `• Profit: $${totalProfit.toFixed(2)}\n` +
      `• Timestamp: ${new Date().toUTCString()}`
    )

    return res.status(200).json({
      success: true,
      settledCount: totalSettled,
      houseProfit: totalProfit
    })

  } catch (err: any) {
    console.error('❌ Settlement process crashed:', err)
    await sendAdminNotification(
      `🚨 CRITICAL: Settlement failed\n` +
      `Error: ${err.message}\n` +
      `Stack: ${err.stack}`
    )
    return res.status(500).json({ 
      success: false, 
      error: process.env.NODE_ENV === 'development' 
        ? err.message 
        : 'Internal server error' 
    })
  }
}

async function settleSingleMarket(market: any) {
  return await prisma.$transaction(async (tx) => {
    // 1. Validate outcome
    const outcome = market.resolvedOutcome?.toUpperCase()
    if (!['YES', 'NO'].includes(outcome)) {
      await tx.market.update({
        where: { id: market.id },
        data: { status: 'settled' }
      })
      return { settled: true, profit: 0 }
    }

    // 2. Calculate pools and fees
    const totalPool = market.poolYes + market.poolNo
    const tradingFee = totalPool * 0.01 * 2 // 1% each side
    const houseCut = totalPool * 0.10 // 10% house cut
    const winningPool = outcome === 'YES' ? market.poolYes : market.poolNo
    const payoutFactor = winningPool > 0 
      ? (totalPool - tradingFee - houseCut) / winningPool 
      : 0

    // 3. Process winning trades
    const winningTrades = market.trades.filter(
      (t: any) => t.type?.toUpperCase() === outcome
    )

    for (const trade of winningTrades) {
      const profit = trade.amount * payoutFactor - (trade.fee || 0)
      await tx.user.update({
        where: { id: trade.userId },
        data: { balance: { increment: profit } }
      })
    }

    // 4. Update all trades as settled
    await tx.trade.updateMany({
      where: { marketId: market.id },
      data: { settled: true }
    })

    // 5. Finalize market
    await tx.market.update({
      where: { id: market.id },
      data: { 
        status: 'settled',
        houseProfit: houseCut,
        settledAt: new Date() 
      }
    })

    return { settled: true, profit: houseCut }
  }, {
    maxWait: 10000, // 10s max wait
    timeout: 30000  // 30s timeout
  })
}