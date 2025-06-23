import request from 'supertest';
import { createServer } from 'http';
import handler from '../../pages/api/markets';
import { prisma } from '../../lib/prisma';

const app = createServer((req, res) => handler(req as any, res as any));

describe('/api/markets GET', () => {
  beforeAll(async () => {
    // seed two markets: one past, one future
    await prisma.market.createMany({
      data: [
        { externalId: 'past', question: 'Past event', eventTime: new Date(Date.now() - 3600 * 1000), status: 'open' },
        { externalId: 'future', question: 'Future event', eventTime: new Date(Date.now() + 3600 * 1000), status: 'open' },
      ],
    });
  });

  afterAll(async () => {
    // clean up
    await prisma.market.deleteMany({ where: { externalId: { in: ['past','future'] } } });
    await prisma.$disconnect();
  });

  it('returns only the future-open market', async () => {
    const res = await request(app).get('/api/markets');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const ids = res.body.map((m: any) => m.externalId);
    expect(ids).toEqual(['future']);
  });
});
