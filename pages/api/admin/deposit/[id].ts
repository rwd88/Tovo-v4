// pages/api/admin/deposit/[id].ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const ALLOWED_STATUSES = ['pending', 'approved', 'rejected'] as const

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // 1) Only PATCH is allowed
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', ['PATCH'])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }

  // 2) Validate & parse `id`
  const { id } = req.query
  const idString = Array.isArray(id) ? id[0] : id
  const depositId = parseInt(idString, 10)
  if (!idString || isNaN(depositId)) {
    return res.status(400).json({ error: 'Invalid or missing deposit id' })
  }

  // 3) Validate `status`
  const { status } = req.body
  if (typeof status !== 'string' || !ALLOWED_STATUSES.includes(status as any)) {
    return res.status(400).json({ error: `Invalid status; must be one of ${ALLOWED_STATUSES.join(', ')}` })
  }

  // 4) Perform the update
  try {
    const updated = await prisma.deposit.update({
      where: { id: depositId },
      data: { status },
    })
    return res.status(200).json(updated)
  } catch (error: any) {
    console.error('Failed to update deposit:', error)

    // Prisma error when record not found
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Deposit not found' })
    }

    return res.status(500).json({ error: 'Unable to update deposit' })
  }
}
