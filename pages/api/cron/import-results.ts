// pages/api/cron/import-results.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import { prisma } from '../../../lib/prisma';

interface ApiResponse {
  success: boolean;
  importedResults?: number;
  failures?: string[];
  error?: string;
  warning?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // 1. Authentication
  const providedSecret =
    (req.query.secret as string) ||
    req.headers.authorization?.split(' ')[1];

  if (!process.env.CRON_SECRET) {
    console.error('CRON_SECRET not configured');
    return res.status(500).json({
      success: false,
      error: 'Server configuration error'
    });
  }

  if (providedSecret !== process.env.CRON_SECRET) {
    console.warn('Unauthorized access attempt to import-results');
    return res.status(403).json({
      success: false,
      error: 'Unauthorized'
    });
  }

  console.log('⏳ Starting results import job');

  try {
    // 2. Fetch and parse XML feed
    const feedUrl = 'https://nfs.faireconomy.media/ff_calendar_thisweek.xml'; // <-- UPDATED URL
    console.log(`→ Fetching XML feed from ${feedUrl}`);

    const { data: xml } = await axios.get<string>(feedUrl, {
      responseType: 'text',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ForexFactoryBot/1.0)',
      },
    });

    console.log('✔ XML feed received, parsing...');
    const parsed = await parseStringPromise(xml, {
      explicitArray: false,
      trim: true,
    });

    // 3. Normalize items array
    const items = parsed?.weeklyevents?.event
      ? Array.isArray(parsed.weeklyevents.event)
        ? parsed.weeklyevents.event
        : [parsed.weeklyevents.event]
      : [];

    console.log(`→ Processing ${items.length} calendar events`);

    // 4. Process and update outcomes
    let processed = 0;
    const failures: string[] = [];
    const skipped: string[] = [];

    for (const item of items) {
      const eventId = item.id || item.url || (item.title + item.date + item.time);
      const actual = item.actual;
      if (!eventId) {
        skipped.push('missing-id');
        continue;
      }
      if (!actual) {
        skipped.push(eventId);
        continue;
      }
      try {
        const result = await prisma.market.updateMany({
          where: {
            externalId: eventId,
            outcome: null,
          },
          data: {
            outcome: actual,
            status: 'resolved',
          },
        });

        if (result.count > 0) {
          processed++;
        } else {
          skipped.push(eventId);
        }
      } catch (error) {
        console.error(`Failed to update event ${eventId}:`, error);
        failures.push(eventId);
      }
    }

    console.log(`✔ Results import complete - ${processed} updated, ${failures.length} failed`);

    // 5. Return comprehensive response
    return res.status(200).json({
      success: true,
      importedResults: processed,
      failures,
      warning: skipped.length > 0 ? `${skipped.length} items skipped` : undefined,
    });

  } catch (error) {
    console.error('❌ Results import failed:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
}
