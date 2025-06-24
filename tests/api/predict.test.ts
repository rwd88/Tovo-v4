// tests/api/predict.test.ts
import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';

// 1) Import your handler
import handler from '../../pages/api/bot/predict';

// 2) Import the *mocked* modules
import { prisma } from '../../lib/prisma';
import { calculateShares } from '../../lib/cpmm';

// 3) Tell Jest to swap in your manual mocks from lib/__mocks__/
jest.mock('../../lib/prisma');
jest.mock('../../lib/cpmm');

describe('POST /api/bot/predict', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock out Prisma calls
    prisma.market.findUnique.mockResolvedValue({
      question:  'Will it rain tomorrow?',
      poolYes:   50,
      poolNo:    50,
      status:    'open',
      externalId:'EXT123'
    });
    prisma.trade.create.mockResolvedValue({ id: 'TRADE123' });
    prisma.user.update.mockResolvedValue({ balance: 89 });
    prisma.$transaction.mockImplementation(ops =>
      Promise.all(ops.map((op: any) => op))
    );

    // Mock CPMM share calculation
    (calculateShares as jest.Mock).mockReturnValue(10);
  });

  it('returns 200 and correct trade response', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        userId:     'USER1',
        marketId:   'MARKET1',
        amount:     20,
        prediction: 'YES',
      },
    });

    await handler(req, res);

    // 1️⃣ Status
    expect(res._getStatusCode()).toBe(200);

    // 2️⃣ Payload
    const json = res._getJSONData() as any;
    expect(json).toMatchObject({
      success:    true,
      tradeId:    'TRADE123',
      shares:     10,
      payout:     10,  // 10 * (50/50)
      newBalance: 89,
    });

    // 3️⃣ calculateShares called correctly
    expect(calculateShares).toHaveBeenCalledWith(
      20,  // amount
      50,  // poolYes
      50,  // poolNo
      'YES'
    );

    // 4️⃣ Prisma.trade.create called with correct data
    expect(prisma.trade.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId:   'USER1',
          marketId: 'MARKET1',
          amount:   20,
          fee:      0.2,
          payout:   10,
          shares:   10,
          settled:  false,
        }),
      })
    );
  });
});
