import type { NextApiRequest, NextApiResponse } from 'next'
import { verifyMessage } from 'ethers'
import { prisma } from '../../lib/prisma'

type TradeRequest = {
  marketId:      string
  side:          'UP' | 'DOWN'
  amount:        number
  walletAddress: string
  signature?:    string
}

type TradeResponse =
  | { success: true; tradeId: string; market?: any }
  | { success: false; error: string }

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TradeResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const { marketId, side, amount, walletAddress, signature } =
    req.body as TradeRequest

  if (
    !marketId ||
    !walletAddress ||
    !['UP', 'DOWN'].includes(side) ||
    typeof amount !== 'number'
  ) {
    return res
      .status(400)
      .json({ success: false, error: 'Invalid or missing fields' })
  }

  // optional EIP-191 signature check
  if (signature) {
    const message = `Tovo Trade:${marketId}:${side}:${amount}`
    const signer = verifyMessage(message, signature)
    if (signer.toLowerCase() !== walletAddress.toLowerCase()) {
      return res
        .status(401)
        .json({ success: false, error: 'Signature verification failed' })
    }
  }

  try {
    const market = await prisma.market.findUnique({ where: { id: marketId } })
    if (!market) {
      return res
        .status(404)
        .json({ success: false, error: 'Market not found' })
    }

    // create user if missing
    await prisma.user.upsert({
      where: { id: walletAddress },
      create: {
        id: walletAddress,
        telegramId: walletAddress,
        balance: 0,
      },
      update: {},
    })

    // fetch user to check balance
    const user = await prisma.user.findUnique({ where: { id: walletAddress } })
    if (!user || user.balance < amount) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient balance to place this bet.',
      })
    }

    // deduct balance BEFORE creating trade
    await prisma.user.update({
      where: { id: walletAddress },
      data: { balance: { decrement: amount } },
    })

    const fee    = parseFloat((amount * 0.01).toFixed(6))
    const payout = parseFloat((amount - fee).toFixed(6))
    const shares = amount

    const trade = await prisma.trade.create({
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

    const updated = await prisma.market.update({
      where: { id: marketId },
      data:
        side === 'UP'
          ? { poolYes: { increment: amount } }
          : { poolNo:  { increment: amount } },
    })

    return res
      .status(200)
      .json({ success: true, tradeId: trade.id, market: updated })
  } catch (err: any) {
    console.error('[/api/trade] error:', err)
    return res
      .status(500)
      .json({ success: false, error: 'Server error' })
  }
}
