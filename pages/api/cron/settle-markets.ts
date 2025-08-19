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
  payoutEnabled?: boolean
  error?: string
}

/**
 * Best-effort detection of payout env config.
 * Adjust names if your lib/payout uses different ones.
 */
function getPayoutConfig() {
  const cfg = {
    EVM_RPC_URL: process.env.EVM_RPC_URL || process.env.NEXT_PUBLIC_EVM_RPC_URL,
    EVM_PRIVATE_KEY: process.env.EVM_PRIVATE_KEY,
    HOUSE_WALLET: process.env.HOUSE_WALLET || process.env.NEXT_PUBLIC_HOUSE_WALLET,
    TOKEN_ADDRESS: process.env.TOKEN_ADDRESS || process.env.NEXT_PUBLIC_TOKEN_ADDRESS, // USDT/USDC
  }
  const missing = Object.entries(cfg)
    .filter(([, v]) => !v)
    .map(([k]) => k)
  return { cfg, missing, ok: missing.length === 0 }
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

  const { ok: payoutEnabled, missing } = getPayoutConfig()
  if (!payoutEnabled) {
    // Warn once per run (don’t crash the job)
    await sendAdminAlert?.(
      `⚠️ settle-markets: payout disabled — missing envs: ${missing.join(', ')}`
    ).catch(() => {})
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
          eventTime: { lt: new Date() },   // in the past
          resolvedOutcome: { not: null },  // result already decided
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
          // 1) DB transaction: compute winners, credit balances, mark settled
          const { payouts, tradingFee, houseCut } = await prisma.$transaction(async (tx) => {
            const outcome = determineMarketResult(m)
            if (!outcome) {
              await tx.market.update({
                where: { id: m.id },
                data: { status: 'settled', settledAt: new Date(), houseProfit: 0 },
              })
              return { payouts: [], tradingFee: 0, houseCut: 0 }
            }

            const totalPool = m.poolYes + m.poolNo
            const tradingFee = totalPool * 0.01 * 2   // your current fee logic
            const houseCut = totalPool * 0.10
            const winningPool = outcome === 'YES' ? m.poolYes : m.poolNo
            const distributable = Math.max(totalPool - tradingFee - houseCut, 0)
            const factor = winningPool > 0 ? distributable / winningPool : 0

            const payouts: { userId: string; amount: number }[] = []
            for (const t of m.trades) {
              if (t.type.toUpperCase() === outcome) {
                const userProfit = t.amount * factor - (t.fee || 0)
                if (userProfit > 0) {
                  await tx.user.update({
                    where: { id: t.userId },
                    data: { balance: { increment: userProfit } },
                  })
                }
                payouts.push({ userId: t.userId, amount: Math.max(userProfit, 0) })
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

          // 2) Optional on‑chain payouts (skip if env missing)
          if (payoutEnabled) {
            // Winners
            for (const { userId, amount } of payouts) {
              if (amount <= 0) continue
              const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { walletAddress: true },
              })
              if (!user?.walletAddress) {
                await sendAdminAlert?.(`No wallet address for user ${userId}`).catch(() => {})
                continue
              }
              try {
                await payToken(user.walletAddress, amount)
              } catch (err: any) {
                console.error(`❌ Payout to ${userId} failed:`, err)
                await sendAdminAlert?.(
                  `Payout to ${userId} failed: ${err?.message || err}`
                ).catch(() => {})
              }
            }

            // Trading fees to house
            if (tradingFee > 0) {
              try {
                await payHouse(tradingFee)
                totalFeesSent += tradingFee
              } catch (err: any) {
                console.error('❌ Trading fee transfer failed:', err)
                await sendAdminAlert?.(
                  `Trading fee transfer failed: ${err?.message || err}`
                ).catch(() => {})
              }
            }

            // House cut
            if (houseCut > 0) {
              try {
                await payHouse(houseCut)
                totalProfit += houseCut
              } catch (err: any) {
                console.error('❌ House fee transfer failed:', err)
                await sendAdminAlert?.(
                  `House fee transfer failed: ${err?.message || err}`
                ).catch(() => {})
              }
            }
          }

          totalSettled++
        } catch (innerErr: any) {
          console.error('❌ Settlement error on market', m.id, innerErr)
          await sendAdminAlert?.(
            `Failed to settle market ${m.id}: ${innerErr?.message || innerErr}`
          ).catch(() => {})
        }
      }
    }

    const summary = `Settled ${totalSettled} markets • Fees sent ${totalFeesSent.toFixed(
      2
    )} • House profit ${totalProfit.toFixed(2)} • Payouts ${
      payoutEnabled ? 'ON' : 'OFF (env missing)'
    }`

    await sendCronSummary?.(summary).catch(() => {})

    return res.status(200).json({
      success: true,
      settledCount: totalSettled,
      totalFeesSent,
      houseProfit: totalProfit,
      payoutEnabled,
    })
  } catch (err: any) {
    console.error('🔥 settle-markets crashed:', err)
    await sendAdminAlert?.(`settle-markets crashed: ${err?.message || err}`).catch(() => {})
    return res.status(500).json({ success: false, error: err?.message || 'Unknown error' })
  }
}
