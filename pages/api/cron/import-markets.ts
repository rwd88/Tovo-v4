import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import { prisma } from '../../../lib/prisma';

export default async function handler(req, res) {
  try {
    const xml = (await axios.get(process.env.FF_XML_URL!)).data;
    const json = await parseStringPromise(xml, {
      explicitArray: false,
      trim: true,
      mergeAttrs: true
    });

    // DEBUG: log the structure to see where events live
    console.log(JSON.stringify(json, null, 2));
interface CalendarEvent {
  id?: string;
  url?: string;
  title?: string;
  date?: string;
  time?: string;
  impact?: string;
  forecast?: string;
}

interface ApiResponse {
  success: boolean;
  tradesDeleted?: number;
  marketsDeleted?: number;
  added?: number;
  skipped?: number;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // Auth check
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
    const parsed = await parseStringPromise(xml, { explicitArray: false, trim: true });

    const events: CalendarEvent[] = parsed?.weeklyevents?.event
      ? Array.isArray(parsed.weeklyevents.event)
        ? parsed.weeklyevents.event
        : [parsed.weeklyevents.event]
      : [];

    console.log(`📅 Fetched ${events.length} events`);

    // Skip deletion (markets/trades) unless explicitly needed
    let added = 0;
    let skipped = 0;

    for (const ev of events) {
      const impact = ev.impact?.trim().toLowerCase();
      if (impact !== 'high') {
        skipped++;
        continue;
      }

      const dateStr = ev.date?.trim();
      const timeStr = ev.time?.trim();
      if (!dateStr || !timeStr) {
        console.warn(`⚠ Missing date/time for event: ${ev.title}`);
        skipped++;
        continue;
      }

      // Parse date safely (UTC)
      const eventTime = new Date(`${dateStr}T${timeStr}Z`);
      if (isNaN(eventTime.getTime())) {
        console.warn(`⚠ Invalid date: ${dateStr} ${timeStr} for "${ev.title}"`);
        skipped++;
        continue;
      }

      // Skip past events
      if (eventTime < new Date()) {
        skipped++;
        continue;
      }

      // Create market
      try {
        await prisma.market.upsert({
          where: { externalId: ev.url || `ff-${ev.title}-${dateStr}-${timeStr}` },
          create: {
            externalId: ev.url || `ff-${ev.title}-${dateStr}-${timeStr}`,
            question: ev.title?.trim() || 'Unknown Event',
            status: 'open',
            eventTime,
            forecast: ev.forecast ? parseFloat(ev.forecast) : null,
            poolYes: 0,
            poolNo: 0,
          },
          update: {}, // No updates if exists
        });
        added++;
      } catch (err) {
        console.error(`❌ Failed to upsert market: ${err}`);
      }
    }

    return res.status(200).json({
      success: true,
      added,
      skipped,
    });

  } catch (err) {
    console.error('❌ Import failed:', err);
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}