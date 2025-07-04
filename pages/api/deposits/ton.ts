// pages/api/deposits/ton.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // We're expecting the TON chainId from env, not from the request body:
    const TON_CHAIN_ID = Number(process.env.TON_CHAIN_ID || '102')

    // Fetch all on-chain deposits for TON, newest first
    const deposits = await prisma.deposit.findMany({
      where: { chainId: TON_CHAIN_ID },
      orderBy: { createdAt: 'desc' },
      // only select the fields you have in your DB
      select: {
        id: true,
        chainId: true,
        address: true,
        amount: true,
        txHash: true,
        blockNumber: true,
        createdAt: true,
      },
    })

    return res.status(200).json(deposits)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Unable to fetch TON deposits' })
  }
}
