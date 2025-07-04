// pages/api/deposit.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // 1) Only allow POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }

  // 2) Destructure & validate body
  const { chainId, address, amount, txHash, blockNumber } = req.body
  if (
    typeof chainId     !== 'number' ||
    typeof address     !== 'string' ||
    typeof amount      !== 'string' ||
    typeof txHash      !== 'string' ||
    typeof blockNumber !== 'number'
  ) {
    return res.status(400).json({ error: 'Missing or invalid fields' })
  }

  // 3) Create the deposit record
  try {
    const deposit = await prisma.deposit.create({
      data: {
        chainId,
        address,
        amount,
        txHash,
        blockNumber,
      },
    })
    return res.status(201).json(deposit)
  } catch (error: any) {
    console.error('Error creating deposit:', error)
    return res.status(500).json({ error: 'Unable to create deposit' })
  }
}
