// src/pages/api/cron/settle-markets.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { determineMarketResult } from '../../../lib/market-utils'
import { sendCronSummary, sendAdminAlert } from '../../../lib/telegram'
import { payToken, payHouse } from '../../../lib/payout'

export const config = {
  api: { bodyParser: false },
  maxDuration: 90,
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
      const markets = await prisma.market.findMany({
        where: {
          status:         'open',
          eventTime:      { lt: new Date() },
          resolvedOutcome:{ not: null },
        },
        include: {
          trades: {
            where:   { settled: false },
            select:  { userId: true, type: true, amount: true, fee: true },
          },
        },
        take:     BATCH_SIZE,
        orderBy:  { eventTime: 'asc' },
      })

      if (markets.length === 0) {
        hasMore = false
        break
      }

      for (const m of markets) {
        try {
          // 1) Run DB transaction to mark settled, update balances, collect payouts
          const { payouts, houseCut } = await prisma.$transaction(async (tx) => {
            const outcome = determineMarketResult(m)
            if (!outcome) {
              await tx.market.update({
                where: { id: m.id },
                data:  { status: 'settled' },
              })
              return { payouts: [], houseCut: 0 }
            }

            const totalPool   = m.poolYes + m.poolNo
            const tradingFee  = totalPool * 0.01 * 2    // 1% on each side
            const houseCut    = totalPool * 0.10        // 10% of combined pool
            const winningPool= outcome === 'YES' ? m.poolYes : m.poolNo
            const payoutFactor =
              winningPool > 0 ? (totalPool - tradingFee - houseCut) / winningPool : 0

            const payouts: { userId: string; amount: number }[] = []
            // update user balances off-chain and build payout list
            for (const t of m.trades) {
              if (t.type.toUpperCase() === outcome) {
                const userProfit = t.amount * payoutFactor - (t.fee || 0)
                // off-chain balance update (in-app)
                await tx.user.update({
                  where: { id: t.userId },
                  data:  { balance: { increment: userProfit } },
                })
                // record for on-chain transfer
                payouts.push({ userId: t.userId, amount: userProfit })
              }
            }

            // mark trades settled
            await tx.trade.updateMany({
              where: { marketId: m.id },
              data:  { settled: true },
            })

            // finalize market
            await tx.market.update({
              where: { id: m.id },
              data: {
                status:      'settled',
                houseProfit: houseCut,
                settledAt:   new Date(),
              },
            })

            return { payouts, houseCut }
          })

          // 2) On-chain payouts (winners)
          for (const { userId, amount } of payouts) {
            try {
              await payToken(userId, amount)
            } catch (err: any) {
              console.error(`❌ On-chain payout failed for ${userId}:`, err)
              await sendAdminAlert(`Payout to ${userId} failed: ${err.message}`)
            }
          }

          // 3) On-chain house fee
          if (houseCut > 0) {
            try {
              await payHouse(houseCut)
            } catch (err: any) {
              console.error('❌ House fee transfer failed:', err)
              await sendAdminAlert(`House fee transfer failed: ${err.message}`)
            }
          }

          totalSettled++
          totalProfit += houseCut
        } catch (innerErr: any) {
          console.error('❌ Settlement error on market', m.id, innerErr)
          await sendAdminAlert(`Failed to settle market ${m.id}: ${innerErr.message}`)
        }
      }
    }

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
