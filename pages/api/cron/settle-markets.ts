// src/pages/api/cron/settle-markets.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { determineMarketResult } from '../../../lib/market-utils'
import { sendCronSummary, sendAdminAlert } from '../../../lib/telegram'

export const config = {
  api: { bodyParser: false },
  maxDuration: 90, // 1m30s max
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
  // authenticate via ?secret=, Authorization: Bearer or x-cron-secret
  const token =
    (req.query.secret as string) ||
    req.headers.authorization?.replace('Bearer ', '') ||
    (req.headers['x-cron-secret'] as string) ||
    ''

  if (token !== process.env.CRON_SECRET) {
    return res.status(403).json({ success: false, error: 'Invalid credentials' })
  }

  try {
    const BATCH_SIZE = 25
    let totalSettled = 0
    let totalProfit = 0
    let hasMore = true

    while (hasMore) {
      // only pull fields you actually have in your schema
      const markets = await prisma.market.findMany({
        where: {
          status: 'open',
          eventTime: { lt: new Date() },
          resolvedOutcome: { not: null },
        },
        include: {
          trades: {
            where: { settled: false },
            select: { userId: true, type: true, amount: true, fee: true },
          },
        },
        take: BATCH_SIZE,
        orderBy: { eventTime: 'asc' },
      })

      if (markets.length === 0) {
        hasMore = false
        break
      }

      for (const m of markets) {
        try {
          const { settled, profit } = await prisma.$transaction(async (tx) => {
            const outcome = determineMarketResult(m)
            if (!outcome) {
              // mark closed with no payouts
              await tx.market.update({
                where: { id: m.id },
                data: { status: 'settled' },
              })
              return { settled: true, profit: 0 }
            }

            const totalPool = m.poolYes + m.poolNo
            const tradingFee = totalPool * 0.01 * 2
            const houseCut = totalPool * 0.10
            const winningPool = outcome === 'YES' ? m.poolYes : m.poolNo
            const payoutFactor =
              winningPool > 0 ? (totalPool - tradingFee - houseCut) / winningPool : 0

            // pay winners
            for (const t of m.trades) {
              if (t.type.toUpperCase() === outcome) {
                const userProfit = t.amount * payoutFactor - (t.fee || 0)
                await tx.user.update({
                  where: { id: t.userId },
                  data: { balance: { increment: userProfit } },
                })
              }
            }

            // mark all trades settled
            await tx.trade.updateMany({
              where: { marketId: m.id },
              data: { settled: true },
            })

            // finalize market record
            await tx.market.update({
              where: { id: m.id },
              data: {
                status: 'settled',
                houseProfit: houseCut,
                settledAt: new Date(),
              },
            })

            return { settled: true, profit: houseCut }
          })

          totalSettled += settled ? 1 : 0
          totalProfit += profit
        } catch (innerErr: any) {
          console.error('❌ settlement error on market', m.id, innerErr)
          await sendAdminAlert(`Failed to settle market ${m.id}: ${innerErr.message}`)
        }
      }
    }

    // once done send a summary
    await sendCronSummary(
      `Settled ${totalSettled} markets • House profit $${totalProfit.toFixed(2)}`
    )

    return res
      .status(200)
      .json({ success: true, settledCount: totalSettled, houseProfit: totalProfit })
  } catch (err: any) {
    console.error('🔥 settle-markets crashed:', err)
    await sendAdminAlert(`settle-markets crashed: ${err.message}`)
    return res.status(500).json({ success: false, error: err.message })
  }
}
