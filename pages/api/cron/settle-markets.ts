// src/pages/api/cron/settle-markets.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { determineMarketResult, notifyAdmin } from '../../../lib/market-utils'
import { sendCronSummary, sendAdminNotification } from '../../../lib/telegram'

export const config = {
  api: { bodyParser: false },
  maxDuration: 90, // allow up to 90s for large batches
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
  // auth via ?secret= or Authorization: Bearer or X-Cron-Secret
  const token =
    (req.query.secret as string) ||
    req.headers.authorization?.replace('Bearer ', '') ||
    (req.headers['x-cron-secret'] as string) ||
    ''
  if (token !== process.env.CRON_SECRET) {
    console.warn('🔒 Unauthorized settlement attempt', {
      ip: req.headers['x-forwarded-for'],
      time: new Date().toISOString(),
    })
    return res.status(403).json({ success: false, error: 'Invalid credentials' })
  }

  try {
    console.log('🚀 Starting market settlement batch')
    const BATCH_SIZE = 25
    let totalSettled = 0
    let totalProfit = 0
    let hasMore = true

    while (hasMore) {
      // only pull fields that exist in schema
      const markets = await prisma.market.findMany({
        where: {
          status: 'open',
          eventTime: { lt: new Date() },
          resolvedOutcome: { not: null },
        },
        include: {
          trades: {
            where: { settled: false },
            select: { id: true, userId: true, type: true, amount: true, fee: true },
          },
        },
        take: BATCH_SIZE,
        orderBy: { eventTime: 'asc' },
      })

      if (markets.length === 0) {
        hasMore = false
        break
      }

      const results = await Promise.allSettled(
        markets.map((m) => settleSingleMarket(m))
      )

      for (const r of results) {
        if (r.status === 'fulfilled') {
          totalSettled += r.value.settled ? 1 : 0
          totalProfit += r.value.profit || 0
        } else {
          console.error('❌ Market settlement error:', r.reason)
          await sendAdminNotification(
            `⚠️ Failed to settle market: ${r.reason?.message}`
          )
        }
      }
    }

    // summary & alert
    await sendCronSummary(
      `🏦 Settlement Complete\n• Markets: ${totalSettled}\n• Profit: $${totalProfit.toFixed(
        2
      )}`
    )
    await notifyAdmin(
      `Settlement finished: ${totalSettled} closed, house profit $${totalProfit.toFixed(2)}`
    )

    return res
      .status(200)
      .json({ success: true, settledCount: totalSettled, houseProfit: totalProfit })
  } catch (err: any) {
    console.error('🔥 Settlement batch crashed:', err)
    await sendAdminNotification(
      `🚨 Settlement failed:\n${err.message}\n${err.stack}`
    )
    return res
      .status(500)
      .json({ success: false, error: err.message })
  }
}

async function settleSingleMarket(market: any) {
  return prisma.$transaction(
    async (tx) => {
      const outcome = determineMarketResult(market) // 'YES' | 'NO' | null
      if (!outcome) {
        // no valid outcome: just mark closed
        await tx.market.update({
          where: { id: market.id },
          data: { status: 'settled' },
        })
        return { settled: true, profit: 0 }
      }

      const totalPool = market.poolYes + market.poolNo
      const tradingFee = totalPool * 0.01 * 2
      const houseCut = totalPool * 0.10
      const winningPool = outcome === 'YES' ? market.poolYes : market.poolNo
      const payoutFactor =
        winningPool > 0 ? (totalPool - tradingFee - houseCut) / winningPool : 0

      // pay out winners
      const winningTrades = market.trades.filter(
        (t: any) => t.type.toUpperCase() === outcome
      )
      for (const t of winningTrades) {
        const profit = t.amount * payoutFactor - (t.fee || 0)
        await tx.user.update({
          where: { id: t.userId },
          data: { balance: { increment: profit } },
        })
      }

      // mark all trades settled
      await tx.trade.updateMany({
        where: { marketId: market.id },
        data: { settled: true },
      })

      // finalize market
      await tx.market.update({
        where: { id: market.id },
        data: {
          status: 'settled',
          houseProfit: houseCut,
          settledAt: new Date(),
        },
      })

      return { settled: true, profit: houseCut }
    },
    { maxWait: 10000, timeout: 30000 }
  )
}
