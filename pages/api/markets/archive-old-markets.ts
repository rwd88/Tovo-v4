// pages/api/cron/archive-old-markets.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'

export const config = {
  api: { bodyParser: false },
  maxDuration: 60,
}

type Resp = {
  success: boolean
  archived?: number
  deleted?: number
  error?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
  // Auth (same as your other crons)
  const token =
    (req.query.secret as string) ||
    req.headers.authorization?.replace('Bearer ', '') ||
    (req.headers['x-cron-secret'] as string) ||
    ''
  if (token !== process.env.CRON_SECRET) {
    return res.status(403).json({ success: false, error: 'Invalid credentials' })
  }

  try {
    const now = new Date()

    // 1) Archive: past events that were never resolved (hide from app)
    const archiveResult = await prisma.market.updateMany({
      where: {
        status: { in: ['open', 'OPEN'] },
        resolved: false,
        resolvedOutcome: null,
        eventTime: { lt: now },
      },
      data: { status: 'archived' }, // any value ≠ 'open' keeps it out of active lists
    })

    // 2) Optional hard delete for long-archived markets (safe batch)
    const retentionDays = Number(process.env.ARCHIVE_RETENTION_DAYS ?? 30)
    const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000)

    // Fetch IDs to delete in small batches (avoid FK issues)
    const oldArchived = await prisma.market.findMany({
      where: { status: 'archived', eventTime: { lt: cutoff } },
      select: { id: true },
      take: 100, // delete up to 100 per run (idempotent nightly)
    })
    let deleted = 0

    if (oldArchived.length > 0) {
      const ids = oldArchived.map((m) => m.id)
      await prisma.$transaction([
        prisma.trade.deleteMany({ where: { marketId: { in: ids } } }),
        prisma.outcome.deleteMany({ where: { marketId: { in: ids } } }),
        prisma.market.deleteMany({ where: { id: { in: ids } } }),
      ])
      deleted = ids.length
    }

    return res.status(200).json({
      success: true,
      archived: archiveResult.count,
      deleted,
    })
  } catch (err: any) {
    console.error('🔥 archive-old-markets crashed:', err)
    return res.status(500).json({ success: false, error: err.message })
  }
}
