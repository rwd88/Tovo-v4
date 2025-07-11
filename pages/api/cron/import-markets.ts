// pages/api/cron/import-markets.ts
import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { parseStringPromise } from "xml2js";
import { prisma } from "../../../lib/prisma";

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
  added: number;
  skipped: number;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // 🔐 auth
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(403).json({ success: false, added: 0, skipped: 0, error: "Unauthorized" });
  }
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, added: 0, skipped: 0, error: "Only GET allowed" });
  }

  try {
    const CAL_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.xml";
    const { data: xml } = await axios.get<string>(CAL_URL);
    const parsed = await parseStringPromise(xml, {
      explicitArray: false,
      trim: true,
    });

    // normalize into an array
    const events: CalendarEvent[] = parsed?.weeklyevents?.event
      ? Array.isArray(parsed.weeklyevents.event)
        ? parsed.weeklyevents.event
        : [parsed.weeklyevents.event]
      : [];

    let added = 0;
    let skipped = 0;
    const now = new Date();

    for (const ev of events) {
      // only high‐impact
      if (ev.impact?.trim().toLowerCase() !== "high") {
        skipped++;
        continue;
      }

      // parse date & time
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
      const iso = `${yyyy}-${mm}-${dd}T${timeFormatted}Z`;
      const eventTime = new Date(iso);
      if (isNaN(eventTime.getTime()) || eventTime < now) {
        skipped++;
        continue;
      }

      const externalId =
        ev.url?.trim() || `ff-${ev.title}-${dateStr}-${timeFormatted}`;
      const forecastVal = ev.forecast ? parseFloat(ev.forecast) : null;

      // upsert
      await prisma.market.upsert({
        where: { externalId },
        create: {
          externalId,
          question: ev.title?.trim() || "Unnamed Event",
          status: "open",
          eventTime,
          ...(forecastVal !== null ? { forecast: forecastVal } : {}),
          poolYes: 0,
          poolNo: 0,
          notified: false,
          resolved: false,
        },
        update: {
          // e.g. update forecast if changed
          ...(forecastVal !== null ? { forecast: forecastVal } : {}),
        },
      });

      added++;
    }

    return res.status(200).json({ success: true, added, skipped });
  } catch (err: any) {
    console.error("❌ import-markets error:", err);
    return res
      .status(500)
      .json({ success: false, added: 0, skipped: 0, error: err.message });
  }
}
