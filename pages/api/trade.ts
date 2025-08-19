// pages/api/trade.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../lib/prisma'
import { sendAdminAlert } from '../../lib/telegram'

type TradeSide = 'YES' | 'NO'

interface TradeResponse {
  success: boolean
  newPoolYes?: number
  newPoolNo?: number
  userBalance?: number
  error?: string
}

function bad(res: NextApiResponse<TradeResponse>, msg: string, code = 400) {
  return res.status(code).json({ success: false, error: msg })
}

// mask a wallet for logs/alerts
function mask(addr: string) {
  if (!addr) return ''
  const s = addr.trim()
  if (s.length <= 10) return s
  return `${s.slice(0, 6)}…${s.slice(-4)}`
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TradeResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return bad(res, 'Only POST allowed', 405)
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body

    const marketId = String(body?.marketId || '').trim()
    const walletAddress = String(body?.walletAddress || '').trim()
    const side = String(body?.side || '').toUpperCase() as TradeSide
    const amount = Number(body?.amount)

    if (!marketId) return bad(res, 'Missing marketId')
    if (!walletAddress) return bad(res, 'Missing walletAddress')
    if (side !== 'YES' && side !== 'NO') return bad(res, 'Side must be YES or NO')
    if (!Number.isFinite(amount) || amount <= 0) return bad(res, 'Amount must be a positive number')

    // Load & validate market state
    const market = await prisma.market.findUnique({
      where: { id: marketId },
      select: {
        id: true,
        question: true,
        status: true,
        eventTime: true,
        resolvedOutcome: true,
      },
    })
    if (!market) return bad(res, 'Market not found', 404)
    if (market.status.toLowerCase() !== 'open') return bad(res, 'Market is not open')
    if (market.resolvedOutcome) return bad(res, 'Market already resolved')
    if (new Date(market.eventTime).getTime() <= Date.now()) return bad(res, 'Market already closed')

    // Fee in basis points; default 1% (100 bps)
    const FEE_BPS = Number(process.env.FEE_BPS ?? 100)
    const fee = Math.max(0, (amount * FEE_BPS) / 10_000)
    const totalDebit = amount + fee

    // Atomically: ensure user, debit balance, update pools/fees, create trade
    const result = await prisma.$transaction(async (tx) => {
      // find/create user
      let user = await tx.user.findUnique({
        where: { walletAddress },
        select: { id: true, balance: true },
      })
      if (!user) {
        user = await tx.user.create({
          data: { walletAddress, balance: 0 },
          select: { id: true, balance: true },
        })
      }

      if (user.balance < totalDebit) {
        throw new Error('Insufficient balance')
      }

      // debit user balance
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: { balance: { decrement: totalDebit } },
        select: { balance: true },
      })

      // update pools & accrue fee
      const updatedMarket = await tx.market.update({
        where: { id: marketId },
        data:
          side === 'YES'
            ? { poolYes: { increment: amount }, feeCollected: { increment: fee } }
            : { poolNo: { increment: amount },  feeCollected: { increment: fee } },
        select: { poolYes: true, poolNo: true },
      })

      // record trade for settlement
      await tx.trade.create({
        data: {
          marketId,
          userId: user.id,
          type: side,         // 'YES' | 'NO'
          amount,
          fee,
          settled: false,
        },
      })

      return {
        newPoolYes: updatedMarket.poolYes,
        newPoolNo:  updatedMarket.poolNo,
        userBalance: updatedUser.balance,
        fee, totalDebit,
      }
    })

    // 🔔 Admin bot: real-time trade notification (non-blocking)
    try {
      await sendAdminAlert?.(
        [
          '🟢 New Trade',
          `• Market: ${market.id}`,
          market.question ? `• Q: ${market.question}` : null,
          `• Wallet: ${mask(walletAddress)}`,
          `• Side: ${side}`,
          `• Amount: ${amount.toFixed(2)}`,
          `• Fee: ${result.fee.toFixed(2)} (${Number(process.env.FEE_BPS ?? 100)} bps)`,
          `• Total debited: ${result.totalDebit.toFixed(2)}`,
          `• Pools → Yes: ${result.newPoolYes?.toFixed(2)} | No: ${result.newPoolNo?.toFixed(2)}`,
          `• When: ${new Date().toISOString()}`,
        ].filter(Boolean).join('\n')
      )
    } catch {
      // do not block response if Telegram fails
    }

    return res.status(200).json({
      success: true,
      newPoolYes: result.newPoolYes,
      newPoolNo: result.newPoolNo,
      userBalance: result.userBalance,
    })
  } catch (err: any) {
    const msg = err?.message || 'Server error'
    // Common user-facing errors kept as 400
    if (
      msg.includes('Insufficient balance') ||
      msg.includes('Missing') ||
      msg.includes('Side must be') ||
      msg.includes('closed')
    ) {
      return bad(res, msg, 400)
    }
    console.error('[/api/trade] failed:', err)
    return bad(res, msg, 500)
  }
}
