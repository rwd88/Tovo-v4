import type { NextApiRequest, NextApiResponse } from 'next'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { network, txHash } = req.body
  if (!network || !txHash) {
    return res.status(400).json({ error: 'Missing network or txHash' })
  }

  try {
    const deposit = await prisma.deposit.create({
      data: { network, txHash }
    })
    return res.status(200).json({ success: true, deposit })
  } catch (e: any) {
    // handle unique constraint or other errors
    console.error(e)
    return res.status(500).json({ error: e.message })
  }
}
