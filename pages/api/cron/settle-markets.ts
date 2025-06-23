// pages/api/cron/settle-markets.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { sendCronSummary, sendAdminAlert } from '../../../lib/telegram'

export const config = {
  maxDuration: 60,
}

interface SettleResponse {
  success: boolean
  totalSettled?: number
  totalProfit?: number
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SettleResponse>
) {
  try {
    console.log('⏳ Starting market settlement process...')

    const batchSize = 20
    let totalSettled = 0
    let totalProfit = 0
    let skip = 0
    let hasMore = true

    while (hasMore) {
      // 1️⃣ Fetch a page of markets ready to settle
      const markets = await prisma.market.findMany({
        where: {
          eventTime: { lt: new Date() },
          outcome: { not: null },
          status: 'open',
        },
        include: { trades: true },
        skip,
        take: batchSize,
        orderBy: { eventTime: 'asc' },
      })

      if (markets.length === 0) {
        hasMore = false
        break
      }

      // 2️⃣ Settle each market in parallel
      const results = await Promise.allSettled(
        markets.map(async (market) => {
          // normalize
          const winning = (market.outcome ?? '').toUpperCase()
          if (!['YES', 'NO'].includes(winning)) {
            // no valid outcome—just close it
            await prisma.market.update({
              where: { id: market.id },
              data: { status: 'settled' },
            })
            return { success: true, profit: 0 }
          }

          const winPool = winning === 'YES' ? market.poolYes : market.poolNo
          const winners = market.trades.filter(
            (t) => t.type?.toUpperCase() === winning
          )

          // compute fees/payout
          const totalPool = market.poolYes + market.poolNo
          const tradingFee = totalPool * 0.01 * 2
          const houseCut = totalPool * 0.1
          const netPool = totalPool - tradingFee - houseCut
          const shareFactor = winPool > 0 ? netPool / winPool : 0

          // perform updates in a single transaction:
          const txs = []

          // 1) payout winning users & mark those trades settled
          for (const t of winners) {
            const profit = t.amount * shareFactor - (t.fee ?? 0)
            txs.push(
              prisma.user.update({
                where: { id: t.userId },
                data: { balance: { increment: profit } },
              })
            )
          }
          // 2) mark winning trades settled
          txs.push(
            prisma.trade.updateMany({
              where: { marketId: market.id, type: winning },
              data: { settled: true },
            })
          )
          // 3) close the market
          txs.push(
            prisma.market.update({
              where: { id: market.id },
              data: { status: 'settled' },
            })
          )

          await prisma.$transaction(txs)
          return { success: true, profit: houseCut }
        })
      )

      // 3️⃣ tally successes + profit
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.success) {
          totalSettled++
          totalProfit += r.value.profit
        }
      }

      skip += batchSize
    }

    // 4️⃣ final Telegram report
    const nextRun = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const nextAt = nextRun.toLocaleTimeString('en-US', { timeZone: 'UTC' })
    await sendCronSummary(
      `🏦 Settlement Complete\n` +
      `• Markets settled: ${totalSettled}\n` +
      `• House profit: $${totalProfit.toFixed(2)}\n` +
      `⌛ Next: ${nextAt} UTC`
    )

    return res.status(200).json({
      success: true,
      totalSettled,
      totalProfit,
    })
  } catch (err) {
    console.error('❌ Settlement process failed:', err)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    await sendAdminAlert(`🚨 Settlement Failed: ${msg}`)
    return res.status(500).json({ success: false, error: msg })
  }
}
