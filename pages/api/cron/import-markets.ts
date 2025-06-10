// pages/api/cron/import-markets.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import { prisma } from '../../../lib/prisma';

interface CalendarEvent {
  url?: string;
  title?: string;
  date?: string;
  time?: string;
  impact?: string;
  forecast?: string;
}

interface ApiResponse {
  success: boolean;
  added?: number;
  skipped?: number;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // Simple bearer auth
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(403).json({ success: false, error: 'Unauthorized' });
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Only GET allowed' });
  }

  try {
    const CAL_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.xml';
    const { data: xml } = await axios.get<string>(CAL_URL);
    const parsed = await parseStringPromise(xml, {
      explicitArray: false,
      trim: true
    });

    // Pull out the events array (or wrap single object in array)
    const events: CalendarEvent[] = parsed?.weeklyevents?.event
      ? Array.isArray(parsed.weeklyevents.event)
        ? parsed.weeklyevents.event
        : [parsed.weeklyevents.event]
      : [];

    console.log(`📅 Fetched ${events.length} total events`);

    let added = 0;
    let skipped = 0;
    const now = new Date();

    for (const ev of events) {
      // 1) Filter only high-impact
      const impact = ev.impact?.trim().toLowerCase();
      if (impact !== 'high') {
        skipped++;
        continue;
      }

      // 2) Parse date & time
      const dateStr = ev.date?.trim();
      const timeStr = ev.time?.trim();
      if (!dateStr || !timeStr) {
        console.warn(`⚠ Missing date/time for "${ev.title}"`);
        skipped++;
        continue;
      }
      const eventTime = new Date(`${dateStr}T${timeStr}Z`);
      if (isNaN(eventTime.getTime())) {
        console.warn(`⚠ Invalid date/time "${dateStr} ${timeStr}" for "${ev.title}"`);
        skipped++;
        continue;
      }

      // 3) Skip past events
      if (eventTime < now) {
        skipped++;
        continue;
      }

      // 4) Upsert into DB
      const externalId = ev.url || `ff-${ev.title}-${dateStr}-${timeStr}`;
      try {
        await prisma.market.upsert({
          where: { externalId },
          create: {
            externalId,
            question: ev.title?.trim() || 'Unnamed Event',
            status: 'open',
            eventTime,
            forecast: ev.forecast ? parseFloat(ev.forecast) : null,
            poolYes: 0,
            poolNo: 0
          },
          update: {} // leave existing markets unchanged
        });
        added++;
      } catch (dbErr) {
        console.error(`❌ DB upsert failed for "${ev.title}":`, dbErr);
        skipped++;
      }
    }

    return res.status(200).json({ success: true, added, skipped });

  } catch (err) {
    console.error('❌ Import-markets error:', err);
    return res
      .status(500)
      .json({ success: false, error: (err as Error).message });
  }
}
