// pages/api/deposits/ton.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // we're tagging all TON deposits under network = "TON"
    const deposits = await prisma.onChainDeposit.findMany({
      where: { network: 'TON' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        network: true,
        txHash: true,
        status: true,
        createdAt: true,
      },
    })

    return res.status(200).json(deposits)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Unable to fetch TON deposits' })
  }
}
