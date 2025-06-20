import type { NextApiRequest, NextApiResponse } from 'next'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const list = await prisma.deposit.findMany({ orderBy: { createdAt: 'desc' } })
  res.status(200).json(list)
}
