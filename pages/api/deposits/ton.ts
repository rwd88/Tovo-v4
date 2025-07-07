// pages/api/deposits/ton.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Read TON_CHAIN_ID from env (must be a number)
const TON_CHAIN_ID = parseInt(process.env.TON_CHAIN_ID || '', 10)
if (isNaN(TON_CHAIN_ID)) {
  throw new Error('Missing or invalid TON_CHAIN_ID in environment')
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const deposits = await prisma.onChainDeposit.findMany({
      where:   { chainId: TON_CHAIN_ID },
      orderBy: { createdAt: 'desc' },
      select:  {
        id:        true,
        chainId:   true,
        txHash:    true,
        status:    true,
        createdAt: true,
      },
    })

    return res.status(200).json(deposits)
  } catch (err) {
    console.error('Unable to fetch TON deposits:', err)
    return res.status(500).json({ error: 'Unable to fetch TON deposits' })
  }
}
