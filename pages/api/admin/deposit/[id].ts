// pages/api/admin/deposit/[id].ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const ALLOWED_STATUSES = ['pending','approved','rejected'] as const

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', ['PATCH'])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }

  // 1) id → string → number
  const { id } = req.query
  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid or missing id' })
  }
  const depositId = parseInt(id, 10)
  if (isNaN(depositId)) {
    return res.status(400).json({ error: `Invalid id: ${id}` })
  }

  // 2) validate status
  const { status } = req.body
  if (
    typeof status !== 'string' ||
    !ALLOWED_STATUSES.includes(status as any)
  ) {
    return res
      .status(400)
      .json({ error: `Status must be one of ${ALLOWED_STATUSES.join(', ')}` })
  }

  // 3) update!
  try {
    const updated = await prisma.onChainDeposit.update({
      where: { id: depositId },
      data:  { status },
    })
    return res.status(200).json(updated)
  } catch (err: any) {
    console.error(err)
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Record not found' })
    }
    return res.status(500).json({ error: 'Unable to update status' })
  }
}
