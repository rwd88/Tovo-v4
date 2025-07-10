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
      trim: true,
    });

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
      if (ev.impact?.trim().toLowerCase() !== 'high') {
        skipped++;
        continue;
      }

      const dateStr = ev.date?.trim();
      const rawTimeStr = ev.time?.trim().toLowerCase();
      if (!dateStr || !rawTimeStr) {
        skipped++;
        continue;
      }

      const m = rawTimeStr.match(/^(\d{1,2}):(\d{2})(am|pm)$/);
      if (!m) {
        console.warn(`⚠ Bad time "${rawTimeStr}" for "${ev.title}"`);
        skipped++;
        continue;
      }

      let hour = parseInt(m[1], 10);
      const minute = m[2];
      const ampm = m[3];
      if (ampm === 'pm' && hour < 12) hour += 12;
      if (ampm === 'am' && hour === 12) hour = 0;
      const timeFormatted = `${hour.toString().padStart(2, '0')}:${minute}:00`;

      const [mm, dd, yyyy] = dateStr.split('-');
      const isoDate = `${yyyy}-${mm}-${dd}T${timeFormatted}Z`;
      const eventTime = new Date(isoDate);
      if (isNaN(eventTime.getTime()) || eventTime < now) {
        skipped++;
        continue;
      }

      const externalId =
        ev.url?.trim() || `ff-${ev.title}-${dateStr}-${timeFormatted}`;

      try {
        await prisma.market.upsert({
          where: { externalId },
          create: {
            externalId,
            question: ev.title?.trim() || 'Unnamed Event',
            status: 'open',
            eventTime,
            poolYes: 0,
            poolNo: 0,
          },
          update: {}, // no-op update
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
