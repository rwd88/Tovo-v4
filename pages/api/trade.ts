// pages/api/trade.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../lib/prisma'
import { sendAdminAlert } from '../../lib/telegram'

type TradeSide = 'YES' | 'NO'
interface TradeResponse {
  success: boolean
  newPoolYes?: number
  newPoolNo?: number
  error?: string
}

const mask = (addr = '') => (addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr)

function bad(res: NextApiResponse<TradeResponse>, msg: string, code = 400) {
  return res.status(code).json({ success: false, error: msg })
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
    const walletAddressRaw = String(body?.walletAddress || '').trim()
    const side = String(body?.side || '').toUpperCase() as TradeSide
    const amount = Number(body?.amount)
    const txHash = (body?.txHash ? String(body.txHash).trim() : null) || undefined

    if (!marketId) return bad(res, 'Missing marketId')
    if (!walletAddressRaw) return bad(res, 'Missing walletAddress')
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddressRaw)) return bad(res, 'Invalid walletAddress format')
    if (side !== 'YES' && side !== 'NO') return bad(res, 'Side must be YES or NO')
    if (!Number.isFinite(amount) || amount <= 0) return bad(res, 'Amount must be positive')

    // Validate market
    const market = await prisma.market.findUnique({
      where: { id: marketId },
      select: { id: true, question: true, status: true, eventTime: true, resolvedOutcome: true, poolYes: true, poolNo: true },
    })
    if (!market) return bad(res, 'Market not found', 404)
    if (market.status.toLowerCase() !== 'open') return bad(res, 'Market is not open')
    if (market.resolvedOutcome) return bad(res, 'Market already resolved')
    if (new Date(market.eventTime).getTime() <= Date.now()) return bad(res, 'Market already closed')

    // Upsert user (no balance usage)
    const user = await prisma.user.upsert({
      where: { walletAddress: walletAddressRaw.toLowerCase() },
      update: {},
      create: { walletAddress: walletAddressRaw.toLowerCase(), balance: 0 },
      select: { id: true },
    })

    // Update pools for UI (note: on-chain is source of truth)
    const updated = await prisma.market.update({
      where: { id: marketId },
      data: side === 'YES'
        ? { poolYes: { increment: amount } }
        : { poolNo:  { increment: amount } },
      select: { poolYes: true, poolNo: true, question: true },
    })

    // Record trade row (optional fields kept)
    await prisma.trade.create({
      data: {
        marketId,
        userId: user.id,
        type: side,
        amount,
        fee: 0,
        settled: false,
        // you can add a txHash column to the Trade model if you want to save it
      },
    })

    // Admin alert (non-blocking)
    try {
      await sendAdminAlert?.(
        [
          '🟢 New Trade (on‑chain logged)',
          `• Market: ${market.id}`,
          updated.question ? `• Q: ${updated.question}` : null,
          `• Wallet: ${mask(walletAddressRaw)}`,
          `• Side: ${side}`,
          `• Amount: ${amount.toFixed(2)} USDC`,
          txHash ? `• Tx: ${txHash.slice(0, 10)}…` : null,
          `• Pools → Yes: ${updated.poolYes.toFixed(2)} | No: ${updated.poolNo.toFixed(2)}`,
          `• When: ${new Date().toISOString()}`,
        ].filter(Boolean).join('\n')
      )
    } catch {}

    return res.status(200).json({ success: true, newPoolYes: updated.poolYes, newPoolNo: updated.poolNo })
  } catch (err: any) {
    console.error('[/api/trade] failed:', err)
    return bad(res, err?.message || 'Server error', 500)
  }
}
