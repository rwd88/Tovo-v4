// tests/api/trade.test.ts
import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';

// Import your handler and the *mocked* modules
import handler from '../../pages/api/trade/Create';
import { prisma } from '../../lib/prisma';
import { sendTelegramMessage } from '../../lib/telegram';

// Tell Jest to replace these with the files in __mocks__/
jest.mock('../../lib/prisma');
jest.mock('../../lib/telegram');

describe('POST /api/trade/Create', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Happy-path mocks:
    prisma.user.upsert.mockResolvedValue({});
    prisma.market.findFirst.mockResolvedValue({ question: 'Is 2+2=4?' });
    prisma.user.findUnique.mockResolvedValue({ balance: 100 });
    prisma.trade.create.mockResolvedValue({ id: 'TRADE_ID' });
    prisma.user.update.mockResolvedValue({ balance: 79.8 });
    prisma.market.update.mockResolvedValue({ poolYes: 20 });
    prisma.$transaction.mockImplementation(ops =>
      // run each step in order and return their results
      Promise.all(ops.map((op: any) => op))
    );
  });

  it('returns 200 and calls prisma + Telegram correctly', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        userId:   'U1',
        marketId: 'M1',
        amount:   20,
        type:     'YES',
      },
    });

    await handler(req, res);

    // HTTP status
    expect(res._getStatusCode()).toBe(200);

    // JSON payload
    const json = res._getJSONData();
    expect(json).toMatchObject({
      success:        true,
      tradeId:        'TRADE_ID',
      newBalance:     79.8,
      marketQuestion: 'Is 2+2=4?',
    });

    // Verify Prisma calls
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where:  { telegramId: 'U1' },
        create: { id: 'U1', telegramId: 'U1', balance: 0 },
      })
    );
    expect(prisma.trade.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 20 }) })
    );

    // And that we notified Telegram
    expect(sendTelegramMessage).toHaveBeenCalled();
  });
});
