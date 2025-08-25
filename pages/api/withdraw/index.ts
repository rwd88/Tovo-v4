// pages/api/withdraw/index.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // you can scope to the logged-in user, or return all for an admin dashboard
  const withdrawals = await prisma.withdrawal.findMany({
    orderBy: { createdAt: 'desc' },
  })
  res.status(200).json(withdrawals)
}
