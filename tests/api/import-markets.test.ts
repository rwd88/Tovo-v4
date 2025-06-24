// tests/api/import-markets.test.ts
import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

// 1) Import your handler (go up two levels from tests/api)
import handler from '../../pages/api/cron/import-markets';

// 2) Import the mocked Prisma (go up two levels from tests/api)
import { prisma } from '../../lib/prisma';

jest.mock('axios');
jest.mock('../../lib/prisma');

describe('GET /api/cron/import-markets', () => {
  const SECRET = 'test-secret';

  beforeAll(() => {
    process.env.CRON_SECRET = SECRET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('403s without correct Bearer token', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET',
      headers: {},
    });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(403);
    expect(res._getJSONData()).toMatchObject({
      success: false,
      error:   'Unauthorized',
    });
  });

  it('405s on non-GET methods', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      headers: { authorization: `Bearer ${SECRET}` },
    });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(405);
    expect(res._getJSONData()).toMatchObject({
      success: false,
      error:   'Only GET allowed',
    });
  });

  it('only upserts High-impact future events', async () => {
    const xml = `
      <weeklyevents>
        <event>
          <title>High Future</title>
          <date>01-01-2999</date>
          <time>12:00pm</time>
          <impact>High</impact>
          <forecast>2.5</forecast>
          <url>http://example.com/high</url>
        </event>
        <event>
          <title>Medium Future</title>
          <date>01-02-2999</date>
          <time>01:00am</time>
          <impact>Medium</impact>
          <forecast>3.5</forecast>
          <url>http://example.com/medium</url>
        </event>
      </weeklyevents>
    `;

    // Mock the HTTP fetch
    (axios.get as jest.Mock).mockResolvedValue({ data: xml });

    // Mock the upsert call
    (prisma.market.upsert as jest.Mock).mockResolvedValue({});

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET',
      headers: { authorization: `Bearer ${SECRET}` },
    });
    await handler(req, res);

    // We fetched the correct URL
    expect(axios.get).toHaveBeenCalledWith(
      'https://nfs.faireconomy.media/ff_calendar_thisweek.xml'
    );

    // Only one upsert (the “High” event)
    expect(prisma.market.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.market.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          externalId: 'http://example.com/high',
        }),
        create: expect.objectContaining({
          externalId: 'http://example.com/high',
          question:   'High Future',
          status:     'open',
        }),
      })
    );

    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toMatchObject({
      success: true,
      added:   1,
      skipped: 1,
    });
  });
});
