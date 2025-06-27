// pages/api/cron/publish-markets.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { autoPublishMarkets } from '../../../src/services/autoPublishMarkets';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await autoPublishMarkets();
    res.status(200).send('OK');
  } catch (err) {
    console.error('Auto-publish failed', err);
    res.status(500).send('Error');
  }
}
