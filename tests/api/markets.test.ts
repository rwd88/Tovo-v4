import express from 'express';
import request from 'supertest';
import handler from '../../pages/api/markets'; // adjust if your test folder is different
import { prisma } from '../../lib/prisma';

const app = express();
app.get('/api/markets', (req, res) => handler(req as any, res as any));

describe('/api/markets GET', () => {
  beforeAll(async () => {
    await prisma.market.createMany({
      data: [
        { externalId: 'past',   question: 'Past event',   eventTime: new Date(Date.now() - 3600 * 1000), status: 'open'  },
        { externalId: 'future', question: 'Future event', eventTime: new Date(Date.now() + 3600 * 1000), status: 'open'  },
      ],
    });
  });

  afterAll(async () => {
    await prisma.market.deleteMany({ where: { externalId: { in: ['past','future'] } } });
    await prisma.$disconnect();
  });

  it('returns only the future-open market', async () => {
    const res = await request(app).get('/api/markets');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.map((m: any) => m.externalId)).toEqual(['future']);
  });
});
