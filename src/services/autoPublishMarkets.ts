// src/services/autoPublishMarkets.ts
import { PrismaClient } from '@prisma/client';
import { notifyNewMarkets } from './telegram';

const prisma = new PrismaClient();

export async function autoPublishMarkets() {
  // 1. Grab all open, un-notified markets ending in the future
  const now = new Date();
  const markets = await prisma.market.findMany({
    where: {
      status: 'open',
      notified: false,
      eventTime: { gt: now }
    }
  });

  if (markets.length === 0) return;

  // 2. Send them to Telegram
  await notifyNewMarkets(markets);

  // 3. Mark them as “notified”
  await prisma.market.updateMany({
    where: { id: { in: markets.map(m => m.id) } },
    data: { notified: true }
  });
}
