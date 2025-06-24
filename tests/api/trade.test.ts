// tests/api/trade.test.ts
import express from 'express';
import request from 'supertest';
import tradeHandler from '../../pages/api/trade/Create';
import { prisma } from '../../lib/prisma';

const app = express();
app.use(express.json());
app.post('/api/trade/Create', (req, res) => tradeHandler(req as any, res as any));

describe('/api/trade/Create POST', () => {
  let marketId: number;

  beforeAll(async () => {
    // 1) Clear out dependent tables
    await prisma.trade.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.market.deleteMany({});

    // 2) Seed one market
    const m = await prisma.market.create({
      data: {
        externalId: 'test-1',
        question: 'Test Market',
        eventTime: new Date(Date.now() + 3600 * 1000),
        status: 'open',
        poolYes: 0,
        poolNo: 0,
      },
    });
    marketId = m.id;
  });

  afterAll(async () => {
    // Clean up
    await prisma.trade.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.market.deleteMany({});
    await prisma.$disconnect();
  });

  it('creates a trade and updates the correct pool', async () => {
    const payload = {
      userId: 'user-abc',
      marketId,
      outcome: 'yes',
      shares: 5,
    };

    const res = await request(app)
      .post('/api/trade/Create')
      .send(payload);

    expect(res.status).toBe(200);
    // Check response shape
    expect(res.body).toMatchObject({
      tradeId: expect.any(Number),
      userId: 'user-abc',
      marketId,
      outcome: 'yes',
      shares: 5,
    });

    // Verify the trade exists in DB
    const trade = await prisma.trade.findUnique({
      where: { id: res.body.tradeId },
    });
    expect(trade).not.toBeNull();
    expect(trade!.shares).toBe(5);
    expect(trade!.outcome).toBe('yes');
    expect(trade!.userId).toBe('user-abc');

    // Verify the pool was updated
    const updatedMarket = await prisma.market.findUnique({ where: { id: marketId } });
    expect(updatedMarket).not.toBeNull();
    expect(updatedMarket!.poolYes).toBe(5);
    expect(updatedMarket!.poolNo).toBe(0);
  });
});
