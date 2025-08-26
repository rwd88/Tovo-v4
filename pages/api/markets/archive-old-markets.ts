// pages/api/markets/archive-old-markets.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import  prisma  from '../../../lib/prisma'

type Q = {
  limit?: string
  cursor?: string // id of the last item from previous page
  before?: string // ISO date to filter older than; default now
  status?: 'closed' | 'settled' | 'any'
}

function serialize(m: any) {
  return {
    ...m,
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

  const { limit = '50', cursor, before, status = 'any' } = (req.query as any) || {}
  const take = Math.min(Math.max(parseInt(String(limit), 10) || 50, 1), 100)

  const beforeDate = before ? new Date(before) : new Date()

  // status filter
  const statusFilter =
    status === 'closed' || status === 'settled'
      ? { status }
      : { status: { in: ['closed', 'settled'] as const } }

  try {
    const rows = await prisma.market.findMany({
      where: {
        ...statusFilter,
        // older than a given date (default: now)
        eventTime: { lt: beforeDate },
      },
      orderBy: { eventTime: 'desc' },
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: String(cursor) } } : {}),
      select: {
        id: true,
        onchainId: true,
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
    console.error('archive markets error:', err)
    return res.status(500).json({ error: 'Failed to load archived markets' })
  }
}
