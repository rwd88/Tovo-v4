// pages/api/trade.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { verifyMessage } from 'ethers'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { rateLimiter } from '../../lib/rateLimiter'

// 1) Define and infer a strict input schema
const tradeSchema = z.object({
  marketId:      z.string().uuid(),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amount:        z.preprocess(
                    (val) => typeof val === 'string' ? parseFloat(val) : val,
                    z.number().positive()
                  ),
  side:          z.enum(['UP', 'DOWN']),
  signature:     z.string(),
})
type TradeInput = z.infer<typeof tradeSchema>

type TradeResponse =
  | { success: true; tradeId: string; market: any }
  | { success: false; error: string; details?: unknown }

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TradeResponse>
) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ success: false, error: 'Method Not Allowed' })
  }

  // Rate‐limit per IP
  try {
    await rateLimiter(req.socket.remoteAddress!)
  } catch {
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  // Validate & parse input
  const parsed = tradeSchema.safeParse(req.body)
  if (!parsed.success) {
    return res
      .status(400)
      .json({ success: false, error: 'Invalid input', details: parsed.error.format() })
  }
  const { marketId, walletAddress, amount, side, signature }: TradeInput = parsed.data

  // Verify one‐time nonce signature
  const record = await prisma.walletNonce.findUnique({ where: { address: walletAddress } })
  if (!record) {
    return res.status(401).json({ success: false, error: 'Nonce not found' })
  }
  try {
    const signer = verifyMessage(record.nonce, signature)
    if (signer.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new Error('Signature mismatch')
    }
  } catch {
    return res
      .status(401)
      .json({ success: false, error: 'Signature verification failed' })
  }
  // Consume the nonce
  await prisma.walletNonce.delete({ where: { address: walletAddress } })

  try {
    // Atomic DB operations
    const { trade, updatedMarket } = await prisma.$transaction(async (tx) => {
      // a) Fetch & check market
      const market = await tx.market.findUnique({ where: { id: marketId } })
      if (!market || market.status !== 'open') {
        throw new Error('Market not open or not found')
      }

      // b) Ensure user exists
      await tx.user.upsert({
        where: { id: walletAddress },
        create: { id: walletAddress, telegramId: walletAddress, balance: 0 },
        update: {},
      })

      // c) Check & deduct balance
      const user = await tx.user.findUnique({ where: { id: walletAddress } })
      if (!user || user.balance < amount) {
        throw new Error('Insufficient balance')
      }
      await tx.user.update({
        where: { id: walletAddress },
        data: { balance: { decrement: amount } },
      })

      // d) Compute fee/payout and record the trade
      const fee    = parseFloat((amount * 0.01).toFixed(6))
      const payout = parseFloat((amount - fee).toFixed(6))
      const shares = amount
      const trade  = await tx.trade.create({
        data: {
          marketId,
          userId:   walletAddress,
          type:     side,
          amount,
          fee,
          payout,
          shares,
        },
      })

      // e) Update the market pool
      const updatedMarket = await tx.market.update({
        where: { id: marketId },
        data:
          side === 'UP'
            ? { poolYes: { increment: amount } }
            : { poolNo:  { increment: amount } },
      })

      return { trade, updatedMarket }
    })

    return res
      .status(200)
      .json({ success: true, tradeId: trade.id, market: updatedMarket })
  } catch (err: any) {
    console.error('[/api/trade] error:', err)
    const msg = err.message.includes('Insufficient')
      ? 'Insufficient balance'
      : err.message.includes('Market not open')
      ? err.message
      : 'Server error'
    const code = msg === 'Insufficient balance'
      ? 400
      : msg.startsWith('Market')
      ? 404
      : 500
    return res.status(code).json({ success: false, error: msg })
  }
}
