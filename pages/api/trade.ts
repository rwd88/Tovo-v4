// pages/api/trade.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../lib/prisma'

type TradeSide = 'YES' | 'NO'

interface TradeResponse {
  success: boolean
  newPoolYes?: number
  newPoolNo?: number
  error?: string
}

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
    const side = String(body?.side || '').toUpperCase() as TradeSide
    const amount = Number(body?.amount)

    if (!marketId) return bad(res, 'Missing marketId')
    if (side !== 'YES' && side !== 'NO') return bad(res, 'Side must be YES or NO')
    if (!Number.isFinite(amount) || amount <= 0) return bad(res, 'Amount must be a positive number')

    // load market and validate state
    const market = await prisma.market.findUnique({
      where: { id: marketId },
      select: {
        id: true,
        status: true,
        eventTime: true,
        resolvedOutcome: true,
      },
    })
    if (!market) return bad(res, 'Market not found', 404)
    if (market.status.toLowerCase() !== 'open') return bad(res, 'Market is not open')
    if (market.resolvedOutcome) return bad(res, 'Market already resolved')
    if (new Date(market.eventTime).getTime() <= Date.now()) return bad(res, 'Market already closed')

    // apply trade atomically
    const updated = await prisma.market.update({
      where: { id: market.id },
      data:
        side === 'YES'
          ? { poolYes: { increment: amount } }
          : { poolNo: { increment: amount } },
      select: { poolYes: true, poolNo: true },
    })

    // NOTE: If your payout cron needs per-user trades, add a trade record here.
    // I’ve left it out because your schema for Trade/User wasn’t shared.
    // We can wire it up once you confirm required fields.

    return res.status(200).json({
      success: true,
      newPoolYes: updated.poolYes,
      newPoolNo: updated.poolNo,
    })
  } catch (err: any) {
    console.error('[/api/trade] failed:', err)
    return bad(res, err?.message || 'Server error', 500)
  }
}
