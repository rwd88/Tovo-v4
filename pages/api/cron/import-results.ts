// pages/api/cron/import-results.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 🔒 Guard: allow secret via query or via Authorization: Bearer
  const providedSecret =
    (req.query.secret as string) ||
    req.headers.authorization?.split(' ')[1];
  if (providedSecret !== process.env.CRON_SECRET) {
    return res.status(404).end();
  }

  try {
    // 1. Fetch ForexFactory XML feed
    const feedUrl = 'https://cdn-nfs.forexfactory.net/ff_calendar_thisweek.xml';
    const { data: xml } = await axios.get<string>(feedUrl, { responseType: 'text' });

    // 2. Parse it
    const parsed = await parseStringPromise(xml, { explicitArray: false });
    const items = Array.isArray(parsed.rss.channel.item)
      ? parsed.rss.channel.item
      : [parsed.rss.channel.item];

    // 3. Update your Market.outcome for each event
    let processed = 0;
    const failures: string[] = [];

    for (const item of items) {
      const eventId = item['ff:calendar_id'];
      const actual  = item['ff:actual']?.trim();
      if (!eventId || !actual) continue;

      try {
        await prisma.market.updateMany({
          where: { externalId: eventId },
          data:  { outcome: actual },
        });
        processed++;
      } catch (err) {
        console.error(`✖ Error updating market ${eventId}`, err);
        failures.push(eventId);
      }
    }

    // 4. Return a summary
    return res.status(200).json({ importedResults: processed, failures });
  } catch (err) {
    console.error('❗ import-results error', err);
    return res.status(500).json({ error: 'Import of event outcomes failed.' });
  }
}
