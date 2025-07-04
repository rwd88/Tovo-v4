import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

const TON_CHAIN_ID = parseInt(process.env.TON_CHAIN_ID || '', 10)
if (!TON_CHAIN_ID) throw new Error('Missing TON_CHAIN_ID in env')

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const deposits = await prisma.deposit.findMany({
      where:   { chainId: TON_CHAIN_ID },
      orderBy: { createdAt: 'desc' },
      select:  {
        id:         true,
        chainId:    true,
        address:    true,
        amount:     true,
        txHash:     true,
        blockNumber:true,
        createdAt:  true,
      },
    })
    res.status(200).json(deposits)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Unable to fetch TON deposits' })
  }
}
