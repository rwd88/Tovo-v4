// pages/api/trade.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST method is allowed' })
  }

  try {
    const { marketId, userId, type, amount } = req.body as {
      marketId?: string
      userId?: string
      type?: 'yes' | 'no'
      amount?: number
    }

    if (
      !marketId ||
      !userId ||
      !type ||
      typeof amount !== 'number' ||
      !['yes', 'no'].includes(type)
    ) {
      return res.status(400).json({ error: 'Invalid or missing data' })
    }

    // 1) Make sure the market exists
    const market = await prisma.market.findUnique({ where: { id: marketId } })
    if (!market) {
      return res.status(404).json({ error: 'Market not found' })
    }

    // 2) Ensure the user exists (or create them)
    await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        telegramId: userId,
      },
      update: {},
    })

    // 3) Calculate fee & payout
    const fee    = amount * 0.01
    const payout = amount - fee

    // 4) Record the trade (now including `shares`)
    const trade = await prisma.trade.create({
      data: {
        marketId,
        userId,
        type,
        amount,
        fee,
        payout,            // payout included in schema
        shares: amount,    // <— required non-nullable field
      },
    })

    // 5) Update the market pools
    const updatedMarket = await prisma.market.update({
      where: { id: marketId },
      data: type === 'yes'
        ? { poolYes: market.poolYes + amount }
        : { poolNo:  market.poolNo  + amount },
    })

    return res.status(200).json({ trade, market: updatedMarket })

  } catch (err) {
    console.error('[/api/trade] error:', err)
    return res.status(500).json({ error: 'Server error' })
  } finally {
    await prisma.$disconnect()
  }
}
