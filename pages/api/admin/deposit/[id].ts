import type { NextApiRequest, NextApiResponse } from 'next'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  if (req.method !== 'PATCH') return res.status(405).end()

  const { status } = req.body
  if (!['pending','approved','rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' })
  }

  const updated = await prisma.deposit.update({
    where: { id: String(id) },
    data: { status },
  })
  res.status(200).json(updated)
}
