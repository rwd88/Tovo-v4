// pages/api/markets/active.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import  prisma  from '../../../lib/prisma'

type Q = {
  limit?: string
  cursor?: string // id of the last item from previous page
}

function serialize(m: any) {
  return {
    ...m,
    // Ensure BigInt is JSON-safe and works with /^\d+$/
    onchainId:
      m.onchainId === null || m.onchainId === undefined
        ? null
        : typeof m.onchainId === 'bigint'
        ? m.onchainId.toString()
        : `${m.onchainId}`,
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { limit = '50', cursor }: Q = (req.query as any) || {}
  const take = Math.min(Math.max(parseInt(String(limit), 10) || 50, 1), 100)

  try {
    const where = {
      status: 'open' as const,
    }

    const rows = await prisma.market.findMany({
      where,
      orderBy: { eventTime: 'asc' },
      take: take + 1, // fetch one extra to know if there's a next page
      ...(cursor ? { skip: 1, cursor: { id: String(cursor) } } : {}),
      select: {
        id: true,
        onchainId: true, // ✅ include on-chain numeric id
        question: true,
        eventTime: true,
        poolYes: true,
        poolNo: true,
        status: true,
        resolved: true,
        resolvedOutcome: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    const hasMore = rows.length > take
    const items = hasMore ? rows.slice(0, take) : rows
    const markets = items.map(serialize)
    const nextCursor = hasMore ? items[items.length - 1].id : null

    return res.json({ markets, nextCursor })
  } catch (err: any) {
    console.error('active markets error:', err)
    return res.status(500).json({ error: 'Failed to load active markets' })
  }
}
