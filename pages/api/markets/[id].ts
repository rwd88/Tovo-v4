// pages/api/markets/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../lib/prisma'

export const runtime = 'nodejs'

function serialize(m: any) {
  return {
    ...m,
    onchainId:
      m?.onchainId == null
        ? null
        : typeof m.onchainId === 'bigint'
        ? m.onchainId.toString()
        : String(m.onchainId),
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const id = String(req.query.id)

  try {
    const m = await prisma.market.findUnique({
      where: { id },
      select: {
        id: true,
        externalId: true,
        question: true,
        eventTime: true,
        forecast: true,
        poolYes: true,
        poolNo: true,
        status: true,
        resolved: true,
        resolvedOutcome: true,
        onchainId: true,                // ✅ critical
        createdAt: true,
        updatedAt: true,
      },
    })
    if (!m) return res.status(404).json({ error: 'Not found' })
    return res.json(serialize(m))
  } catch (e: any) {
    console.error('GET /api/markets/[id] error:', e)
    return res.status(500).json({ error: 'Failed to load market' })
  }
}
