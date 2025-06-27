// pages/api/deposits.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Fetch on-chain deposits, newest first
    const deposits = await prisma.onChainDeposit.findMany({
      orderBy: { createdAt: 'desc' },
    })
    res.status(200).json(deposits)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Unable to fetch deposits' })
  }
}
