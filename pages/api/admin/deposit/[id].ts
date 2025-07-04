// pages/api/admin/deposit/[id].ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const ALLOWED_STATUSES = ['pending', 'approved', 'rejected'] as const

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only PATCH
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', ['PATCH'])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }

  // Ensure `id` is a single string
  const { id } = req.query
  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid or missing deposit id' })
  }

  // Parse to number & check
  const depositId = parseInt(id, 10)
  if (isNaN(depositId)) {
    return res.status(400).json({ error: `Invalid deposit id: ${id}` })
  }

  // Validate `status`
  const { status } = req.body
  if (typeof status !== 'string' || !ALLOWED_STATUSES.includes(status as any)) {
    return res
      .status(400)
      .json({ error: `Invalid status; must be one of ${ALLOWED_STATUSES.join(', ')}` })
  }

  // Perform the update
  try {
    const updated = await prisma.deposit.update({
      where: { id: depositId },
      data: { status },
    })
    return res.status(200).json(updated)
  } catch (error: any) {
    console.error('Failed to update deposit:', error)
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Deposit not found' })
    }
    return res.status(500).json({ error: 'Unable to update deposit' })
  }
}
