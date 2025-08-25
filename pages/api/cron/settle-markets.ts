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
  ok: boolean
  settledCount?: number
  totalFeesSent?: number
  houseProfit?: number
  error?: string
}

/**
 * Economics:
 * - 1% per-trade fee is charged at trade time.
 * - Settlement: house gets HOUSE_CUT_BPS of the losing pool (default 10%).
 * - Winners share the remaining pool pro-rata.
 * - Invalid/no-outcome → settled with no payouts (could be refunds if desired).
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SettlementResult>
) {
  // 🔐 Secret auth
  const token =
    (req.query.secret as string) ||
    req.headers.authorization?.replace('Bearer ', '') ||
    (req.headers['x-cron-secret'] as string) ||
    ''

  if (token !== (process.env.CRON_SECRET || '12345A')) {
    await sendAdminAlert('⚠️ Unauthorized settle-markets call')
    return res.status(403).json({ ok: false, error: 'Unauthorized' })
  }

  // ✅ Only GET allowed (Vercel cron)
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  try {
    const BATCH_SIZE = 25
    const HOUSE_CUT_BPS = Number(process.env.HOUSE_CUT_BPS ?? 1000) // 10%

    let totalSettled = 0
    let totalFeesSent = 0
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

            const houseCut = (losingPool * HOUSE_CUT_BPS) / 10_000
            const distributable = Math.max(totalPool - houseCut, 0)
            const payoutFactor = winningPool > 0 ? distributable / winningPool : 0

            const payouts: { userId: string; amount: number }[] = []
            for (const t of m.trades) {
              if (t.type.toUpperCase() === outcome) {
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

          // OPTIONAL: pay winners on-chain
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
      `✅ Settled ${totalSettled} markets • House cut sent ${totalFeesSent.toFixed(2)}`
    )

    return res.status(200).json({
      ok: true,
      settledCount: totalSettled,
      totalFeesSent,
      houseProfit: totalProfit,
    })
  } catch (err: any) {
    console.error('❌ settle-markets crashed:', err)
    await sendAdminAlert(`settle-markets crashed: ${err.message}`)
    return res.status(500).json({ ok: false, error: err.message })
  }
}
