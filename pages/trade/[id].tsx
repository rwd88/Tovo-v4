// pages/api/markets/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../lib/prisma'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query

  if (req.method === 'GET') {
    // find by exact ID
    const market = await prisma.market.findUnique({
      where: { id: String(id) },
    })
    if (!market) {
      return res.status(404).json({ error: 'Market not found' })
    }
    return res.status(200).json({ market })
  }

  res.setHeader('Allow', ['GET'])
  res.status(405).end(`Method ${req.method} Not Allowed`)
}
