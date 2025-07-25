// pages/api/cron/settle-markets.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { determineMarketResult } from '../../../lib/market-utils'
import { sendAdminNotification, sendCronSummary } from '../../../lib/telegram'

export const config = {
  api: { bodyParser: false },
  maxDuration: 120, // Increased timeout for large batches
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
  // Enhanced authentication with IP whitelisting
  const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  const validIPs = process.env.CRON_ALLOWED_IPS?.split(',') || []
  
  const token = 
    (req.query.secret as string) ||
    req.headers.authorization?.replace('Bearer ', '') ||
    (req.headers['x-cron-secret'] as string)

  if (token !== process.env.CRON_SECRET || (validIPs.length > 0 && !validIPs.includes(clientIP as string))) {
    console.warn('🚨 Unauthorized settlement attempt', {
      ip: clientIP,
      time: new Date().toISOString(),
      method: req.method,
      path: req.url
    })
    
    await sendAdminNotification(
      `🚨 Unauthorized settlement attempt\n` +
      `• IP: ${clientIP}\n` +
      `• Time: ${new Date().toLocaleString()}\n` +
      `• Path: ${req.url}`
    )
    
    return res.status(403).json({ 
      success: false, 
      error: 'Forbidden' 
    })
  }

  try {
    console.log('🚀 Starting market settlement process')
    const BATCH_SIZE = 20
    let totalSettled = 0
    let totalProfit = 0
    let hasMore = true
    let skip = 0

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
            select: {
              id: true,
              userId: true,
              type: true,
              amount: true,
              fee: true,
              marketId: true
            }
          }
        },
        take: BATCH_SIZE,
        skip,
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

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          totalSettled += result.value.settled ? 1 : 0
          totalProfit += result.value.profit || 0
        } else {
          console.error('❌ Market settlement failed:', result.reason)
          await sendAdminNotification(
            `⚠️ Market settlement failed\n` +
            `• Error: ${result.reason?.message || 'Unknown error'}\n` +
            `• Stack: ${result.reason?.stack || 'No stack trace'}`
          )
        }
      }

      skip += BATCH_SIZE
    }

    // Send success notifications
    const summaryMessage = `🏦 Settlement Complete\n` +
      `• Markets Settled: ${totalSettled}\n` +
      `• House Profit: $${totalProfit.toFixed(2)}\n` +
      `• Completed At: ${new Date().toUTCString()}`

    await sendCronSummary(summaryMessage)
    await sendAdminNotification(summaryMessage)

    return res.status(200).json({
      success: true,
      settledCount: totalSettled,
      houseProfit: totalProfit
    })

  } catch (err: any) {
    console.error('🔥 Settlement process crashed:', err)
    
    const errorMessage = `🚨 CRITICAL: Settlement failed\n` +
      `• Error: ${err.message}\n` +
      `• Stack: ${err.stack || 'No stack trace'}\n` +
      `• Time: ${new Date().toUTCString()}`

    await sendAdminNotification(errorMessage)
    
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
    // Validate market outcome
    const outcome = determineMarketResult(market)
    if (!outcome) {
      await tx.market.update({
        where: { id: market.id },
        data: { status: 'settled' }
      })
      return { settled: true, profit: 0 }
    }

    // Calculate pools and fees
    const totalPool = market.poolYes + market.poolNo
    const tradingFee = totalPool * 0.02 // 1% each side
    const houseCut = totalPool * 0.10
    const winningPool = outcome === 'YES' ? market.poolYes : market.poolNo
    const payoutFactor = winningPool > 0 
      ? (totalPool - tradingFee - houseCut) / winningPool 
      : 0

    // Process winning trades
    const winningTrades = market.trades.filter(
      (t: any) => t.type.toUpperCase() === outcome
    )

    for (const trade of winningTrades) {
      const payout = trade.amount * payoutFactor
      const netPayout = payout - (trade.fee || 0)
      
      await tx.user.update({
        where: { id: trade.userId },
        data: { balance: { increment: netPayout } }
      })
    }

    // Mark all trades as settled
    await tx.trade.updateMany({
      where: { marketId: market.id },
      data: { settled: true }
    })

    // Finalize market settlement
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
    maxWait: 15000, // 15s max wait time
    timeout: 45000  // 45s timeout
  })
}