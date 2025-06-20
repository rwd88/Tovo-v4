// pages/api/trade.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { PrismaClient } from '@prisma/client'
import { verifyMessage } from 'ethers'

const prisma = new PrismaClient()

type TradeRequest = {
  marketId: string
  side: 'UP' | 'DOWN'
  amount: number
  walletAddress: string
  signature?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const {
      marketId,
      side,
      amount,
      walletAddress,
      signature,
    } = req.body as TradeRequest

    // Basic validation
    if (
      !marketId ||
      !walletAddress ||
      !['UP', 'DOWN'].includes(side) ||
      typeof amount !== 'number'
    ) {
      return res.status(400).json({ error: 'Invalid or missing fields' })
    }

    // Optional: verify user signature for authentication
    if (signature) {
      const message = `Tovo Trade:${marketId}:${side}:${amount}`
      const signer = verifyMessage(message, signature)
      if (signer.toLowerCase() !== walletAddress.toLowerCase()) {
        return res.status(401).json({ error: 'Signature verification failed' })
      }
    }

    // 1) Ensure the market exists
    const market = await prisma.market.findUnique({
      where: { id: marketId },
    })
    if (!market) {
      return res.status(404).json({ error: 'Market not found' })
    }

    // 2) Upsert the user by wallet address
    await prisma.user.upsert({
      where: { id: walletAddress },
      create: { id: walletAddress, telegramId: null },
      update: {},
    })

    // 3) Calculate fee, payout & shares
    const fee    = parseFloat((amount * 0.01).toFixed(6))
    const payout = parseFloat((amount - fee).toFixed(6))
    const shares = amount   // or some other logic

    // 4) Record the trade
    const trade = await prisma.trade.create({
      data: {
        marketId,
        userId: walletAddress,
        side,
        amount,
        fee,
        payout,
        shares,
        status: 'pending',
      },
    })

    // 5) Update the market’s pool
    const updatedMarket = await prisma.market.update({
      where: { id: marketId },
      data:
        side === 'UP'
          ? { poolYes: market.poolYes + amount }
          : { poolNo:  market.poolNo  + amount },
    })

    return res.status(200).json({ success: true, trade, market: updatedMarket })
  } catch (err) {
    console.error('[/api/trade] error:', err)
    return res.status(500).json({ error: 'Server error' })
  } finally {
    await prisma.$disconnect()
  }
}
