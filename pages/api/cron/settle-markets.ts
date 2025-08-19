// pages/api/cron/settle-markets.ts
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
  totalFeesSent?: number
  houseProfit?: number
  error?: string
}

/**
 * Economics:
 * - 1% per-trade fee was already charged on-chain at trade time (user sent amount+1% to house).
 * - At settlement: house gets 10% of the LOSING pool (HOUSE_CUT_BPS; default 1000=10%).
 * - Winners share the remaining (totalPool - houseCut) pro‑rata.
 * - Losers lose their stake.
 * - If a market is invalid (no outcome), we simply mark settled with no payouts (can add refunds if you want).
 */
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
    const HOUSE_CUT_BPS = Number(process.env.HOUSE_CUT_BPS ?? 1000) // 10%

    let totalSettled = 0
    let totalFeesSent = 0 // houseCut telemetry
    let totalProfit = 0
    let hasMore = true

    while (hasMore) {
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

      for (const m of markets) {
        try {
          const { payouts, houseCut } = await prisma.$transaction(async (tx) => {
            const outcome = determineMarketResult(m)

            // No outcome => settle with no payouts (adjust here for refunds if desired)
            if (!outcome) {
              await tx.trade.updateMany({ where: { marketId: m.id }, data: { settled: true } })
              await tx.market.update({
                where: { id: m.id },
                data: { status: 'settled', settledAt: new Date(), houseProfit: 0 },
              })
              return { payouts: [] as { userId: string; amount: number }[], houseCut: 0 }
            }

            const totalPool = m.poolYes + m.poolNo
            const winningPool = outcome === 'YES' ? m.poolYes : m.poolNo
            const losingPool = outcome === 'YES' ? m.poolNo : m.poolYes

            // House takes 10% of losing pool
            const houseCut = (losingPool * HOUSE_CUT_BPS) / 10_000

            // 1% trade fees were taken on-chain; not part of these pools.
            const distributable = Math.max(totalPool - houseCut, 0)
            const payoutFactor = winningPool > 0 ? distributable / winningPool : 0

            const payouts: { userId: string; amount: number }[] = []
            for (const t of m.trades) {
              if (t.type.toUpperCase() === outcome) {
                // credit = stake * payoutFactor − (stored per-trade fee if any)
                const credit = t.amount * payoutFactor - (t.fee || 0)
                const pay = Math.max(credit, 0)
                if (pay > 0) {
                  await tx.user.update({
                    where: { id: t.userId },
                    data: { balance: { increment: pay } },
                  })
                  payouts.push({ userId: t.userId, amount: pay })
                }
              }
            }

            await tx.trade.updateMany({ where: { marketId: m.id }, data: { settled: true } })
            await tx.market.update({
              where: { id: m.id },
              data: { status: 'settled', houseProfit: houseCut, settledAt: new Date() },
            })

            return { payouts, houseCut }
          })

          // send house cut on-chain
          if (houseCut > 0) {
            try {
              await payHouse(houseCut)
              totalFeesSent += houseCut
              totalProfit += houseCut
            } catch (err: any) {
              console.error('House cut transfer failed', err)
              await sendAdminAlert(`House cut transfer failed: ${err.message}`)
            }
          }

          // OPTIONAL: pay winners on-chain instead of crediting balance.
          // If you want actual token transfers now, uncomment the block below.
          /*
          for (const { userId, amount } of payouts) {
            const user = await prisma.user.findUnique({
              where: { id: userId },
              select: { walletAddress: true },
            })
            if (!user?.walletAddress) {
              await sendAdminAlert(`No wallet for user ${userId}`)
              continue
            }
            try {
              await payToken(user.walletAddress, amount)
            } catch (err: any) {
              console.error(`Payout to ${userId} failed:`, err)
              await sendAdminAlert(`Payout to ${userId} failed: ${err.message}`)
            }
          }
          */

          totalSettled++
        } catch (err: any) {
          console.error('Settlement error on market', m.id, err)
          await sendAdminAlert(`Failed to settle market ${m.id}: ${err.message}`)
        }
      }
    }

    await sendCronSummary(
      `Settled ${totalSettled} markets • House cut sent ${totalFeesSent.toFixed(2)}`
    )
    return res
      .status(200)
      .json({ success: true, settledCount: totalSettled, totalFeesSent, houseProfit: totalProfit })
  } catch (err: any) {
    console.error('settle-markets crashed:', err)
    await sendAdminAlert(`settle-markets crashed: ${err.message}`)
    return res.status(500).json({ success: false, error: err.message })
  }
}
