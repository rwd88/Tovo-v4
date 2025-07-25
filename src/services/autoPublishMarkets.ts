import { PrismaClient } from '@prisma/client'
import { notifyNewMarkets } from './telegram'

const prisma = new PrismaClient()

export type PublishResult = {
  published: number
  ids: string[]
}

export async function autoPublishMarkets(): Promise<PublishResult> {
  const now = new Date()
  const markets = await prisma.market.findMany({
    where: {
      status: 'open',
      notified: false,
      eventTime: { gt: now },
    },
  })

  if (markets.length === 0) {
    return { published: 0, ids: [] }
  }

  // send them all in one batch
  await notifyNewMarkets(markets)

  // mark as notified
  await prisma.market.updateMany({
    where: { id: { in: markets.map((m) => m.id) } },
    data: { notified: true },
  })

  return {
    published: markets.length,
    ids: markets.map((m) => m.id),
  }
}
