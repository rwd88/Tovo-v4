// pages/api/cron/import-results.ts
import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { parseStringPromise } from "xml2js";
import prisma from '../../../lib/prisma'

interface CalendarResult {
  url?: string;
  title?: string;
  date?: string;
  time?: string;
  impact?: string;
  forecast?: string;
  actual?: string;
}

interface ApiResponse {
  success: boolean;
  settled: number;
  skipped: number;
  failures: string[];
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // 🔐 auth (either ?secret= or Bearer)
  const provided =
    (req.query.secret as string) ||
    req.headers.authorization?.split(" ")[1];
  if (provided !== process.env.CRON_SECRET) {
    return res.status(403).json({
      success: false,
      settled: 0,
      skipped: 0,
      failures: [],
      error: "Unauthorized",
    });
  }
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      settled: 0,
      skipped: 0,
      failures: [],
      error: "Only GET allowed",
    });
  }

  try {
    const CAL_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.xml";
    const { data: xml } = await axios.get<string>(CAL_URL, {
      responseType: "text",
      timeout: 10000,
    });
    const parsed = await parseStringPromise(xml, {
      explicitArray: false,
      trim: true,
    });

    const items: CalendarResult[] = parsed?.weeklyevents?.event
      ? Array.isArray(parsed.weeklyevents.event)
        ? parsed.weeklyevents.event
        : [parsed.weeklyevents.event]
      : [];

    let settled = 0;
    let skipped = 0;
    const failures: string[] = [];
    const now = new Date();

    for (const ev of items) {
      // only high‐impact
      if (ev.impact?.trim().toLowerCase() !== "high") {
        skipped++;
        continue;
      }
      // parse date/time
      const dateStr = ev.date?.trim();
      const rawTime = ev.time?.trim().toLowerCase();
      if (!dateStr || !rawTime) {
        skipped++;
        continue;
      }
      const m = rawTime.match(/^(\d{1,2}):(\d{2})(am|pm)$/);
      if (!m) {
        skipped++;
        continue;
      }
      let hour = parseInt(m[1], 10);
      if (m[3] === "pm" && hour < 12) hour += 12;
      if (m[3] === "am" && hour === 12) hour = 0;
      const minute = m[2];
      const timeFormatted = `${hour.toString().padStart(2, "0")}:${minute}:00`;
      const [mm, dd, yyyy] = dateStr.split("-");
      const eventTime = new Date(`${yyyy}-${mm}-${dd}T${timeFormatted}Z`);

      // skip future events
      if (isNaN(eventTime.getTime()) || eventTime > now) {
        skipped++;
        continue;
      }

      const externalId =
        ev.url?.trim() || `${ev.title}-${dateStr}-${timeFormatted}`;
      const forecastVal = ev.forecast ? parseFloat(ev.forecast) : NaN;
      const actualVal = ev.actual ? parseFloat(ev.actual) : NaN;
      if (isNaN(actualVal)) {
        skipped++;
        continue;
      }

      // determine yes/no
      const outcome = !isNaN(forecastVal) && actualVal > forecastVal ? "yes" : "no";

      try {
        const result = await prisma.market.updateMany({
          where: {
            externalId,
            resolved: false,
            eventTime: { lte: now },
          },
          data: {
            resolvedOutcome: outcome,
            resolved: true,
            status: "resolved",
          },
        });

        if (result.count > 0) {
          settled++;
        } else {
          skipped++;
        }
      } catch (er) {
        console.error(`Failed to settle ${externalId}:`, er);
        failures.push(externalId);
      }
    }

    return res.status(200).json({
      success: true,
      settled,
      skipped,
      failures,
    });
  } catch (err: any) {
    console.error("❌ import-results error:", err);
    return res.status(500).json({
      success: false,
      settled: 0,
      skipped: 0,
      failures: [],
      error: err.message,
    });
  }
}
