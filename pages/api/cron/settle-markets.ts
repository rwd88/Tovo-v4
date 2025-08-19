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
  totalFeesSent?: number
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
          const { payouts, tradingFee, houseCut } = await prisma.$transaction(async (tx) => {
            const outcome = determineMarketResult(m)
            if (!outcome) {
              await tx.market.update({
                where: { id: m.id },
                data: { status: 'settled' },
              })
              return { payouts: [], tradingFee: 0, houseCut: 0 }
            }

            const totalPool = m.poolYes + m.poolNo
            const tradingFee = totalPool * 0.01 * 2
            const houseCut = totalPool * 0.10
            const winningPool = outcome === 'YES' ? m.poolYes : m.poolNo
            const payoutFactor =
              winningPool > 0 ? (totalPool - tradingFee - houseCut) / winningPool : 0

            const payouts: { userId: string; amount: number }[] = []
            for (const t of m.trades) {
              if (t.type.toUpperCase() === outcome) {
                const userProfit = t.amount * payoutFactor - (t.fee || 0)
                await tx.user.update({
                  where: { id: t.userId },
                  data: { balance: { increment: userProfit } },
                })
                payouts.push({ userId: t.userId, amount: userProfit })
              }
            }

            await tx.trade.updateMany({
              where: { marketId: m.id },
              data: { settled: true },
            })
            await tx.market.update({
              where: { id: m.id },
              data: {
                status: 'settled',
                houseProfit: houseCut,
                settledAt: new Date(),
              },
            })

            return { payouts, tradingFee, houseCut }
          })

          // on-chain payouts (same as before)
          for (const { userId, amount } of payouts) {
            const user = await prisma.user.findUnique({
              where: { id: userId },
              select: { walletAddress: true },
            })
            if (!user?.walletAddress) continue
            try {
              await payToken(user.walletAddress, amount)
            } catch (err) {
              console.error(`❌ Payout to ${userId} failed:`, err)
            }
          }
          if (tradingFee > 0) {
            try {
              await payHouse(tradingFee)
              totalFeesSent += tradingFee
            } catch (err) {
              console.error('❌ Trading fee transfer failed:', err)
            }
          }
          if (houseCut > 0) {
            try {
              await payHouse(houseCut)
              totalProfit += houseCut
            } catch (err) {
              console.error('❌ House fee transfer failed:', err)
            }
          }

          totalSettled++

          // ✅ NEW: notify admin bot for each market
          const totalPool = m.poolYes + m.poolNo
          const feesToHouse = tradingFee + houseCut
          await sendAdminAlert(
            `✅ Market settled\n• Market ID: ${m.id}\n• Total pool: ${totalPool.toFixed(
              2
            )}\n• Fees sent to admin: ${feesToHouse.toFixed(2)}`
          )
        } catch (innerErr) {
          console.error('❌ Settlement error on market', m.id, innerErr)
        }
      }
    }

    await sendCronSummary(
      `Settled ${totalSettled} markets • Sent fees ${totalFeesSent.toFixed(
        2
      )} • House profit ${totalProfit.toFixed(2)}`
    )
    return res.status(200).json({
      success: true,
      settledCount: totalSettled,
      totalFeesSent,
      houseProfit: totalProfit,
    })
  } catch (err: any) {
    console.error('🔥 settle-markets crashed:', err)
    return res.status(500).json({ success: false, error: err.message })
  }
}
