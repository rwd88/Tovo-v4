// pages/api/cron/settle-markets.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { sendCronSummary, sendAdminAlert } from '../../../lib/telegram'

export const config = {
  // allow up to 60s for a large batch
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
  //  🔐 Verify our cron secret
  if (req.query.secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

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
          outcome:   { not: null },
          status:    'open',
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
          const winning = (market.outcome ?? '').toUpperCase()
          // If outcome is invalid, just mark settled
          if (!['YES', 'NO'].includes(winning)) {
            await prisma.market.update({
              where: { id: market.id },
              data: { status: 'settled' },
            })
            return { success: true, profit: 0 }
          }

          // Pools and winners
          const winPool = winning === 'YES' ? market.poolYes : market.poolNo
          const winners = market.trades.filter(
            (t) => t.type?.toUpperCase() === winning
          )

          // Fees and net pool
          const totalPool  = market.poolYes + market.poolNo
          const tradingFee = totalPool * 0.01 * 2
          const houseCut   = totalPool * 0.1
          const netPool    = totalPool - tradingFee - houseCut
          const shareFactor = winPool > 0 ? netPool / winPool : 0

          // Build transaction array
          const txs: any[] = []

          // 1) Payout winners
          for (const t of winners) {
            const profit = t.amount * shareFactor - (t.fee ?? 0)
            txs.push(
              prisma.user.update({
                where: { id: t.userId },
                data:  { balance: { increment: profit } },
              })
            )
          }

          // 2) Mark winning trades settled
          txs.push(
            prisma.trade.updateMany({
              where: { marketId: market.id, type: winning },
              data:  { settled: true },
            })
          )

          // 3) Close the market
          txs.push(
            prisma.market.update({
              where: { id: market.id },
              data:  { status: 'settled' },
            })
          )

          // Execute all updates in one transaction
          await prisma.$transaction(txs)
          return { success: true, profit: houseCut }
        })
      )

      // 3️⃣ Tally up results
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.success) {
          totalSettled++
          totalProfit += r.value.profit
        }
      }

      skip += batchSize
    }

    // 4️⃣ Send a summary to Telegram
    const nextRun = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const nextAt  = nextRun.toLocaleTimeString('en-US', { timeZone: 'UTC' })
    await sendCronSummary(
      `🏦 Settlement Complete\n` +
      `• Markets settled: ${totalSettled}\n` +
      `• House profit: $${totalProfit.toFixed(2)}\n` +
      `⌛ Next: ${nextAt} UTC`
    )

    return res.status(200).json({
      success:      true,
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
