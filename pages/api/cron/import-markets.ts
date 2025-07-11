// pages/api/cron/import-results.ts
import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { parseStringPromise } from "xml2js";
import { prisma } from "../../../lib/prisma";

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
  settled?: number;
  skipped?: number;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // 🔐 Verify our cron secret
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(403).json({ success: false, error: "Unauthorized" });
  }
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Only GET allowed" });
  }

  try {
    const CAL_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.xml";
    const { data: xml } = await axios.get<string>(CAL_URL);
    const parsed = await parseStringPromise(xml, {
      explicitArray: false,
      trim: true,
    });

    const events: CalendarResult[] = parsed?.weeklyevents?.event
      ? Array.isArray(parsed.weeklyevents.event)
        ? parsed.weeklyevents.event
        : [parsed.weeklyevents.event]
      : [];

    let settled = 0;
    let skipped = 0;
    const now = new Date();

    for (const ev of events) {
      // only high-impact
      if (ev.impact?.trim().toLowerCase() !== "high") {
        skipped++;
        continue;
      }

      // parse date + time
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
      if (isNaN(eventTime.getTime()) || eventTime > now) {
        skipped++;
        continue;
      }

      const externalId =
        ev.url?.trim() || `ff-${ev.title}-${dateStr}-${timeFormatted}`;

      // need forecast + actual to decide outcome
      const forecastVal = ev.forecast ? parseFloat(ev.forecast) : NaN;
      const actualVal = ev.actual ? parseFloat(ev.actual) : NaN;
      if (isNaN(actualVal)) {
        skipped++;
        continue;
      }
      const outcome =
        !isNaN(forecastVal) && actualVal > forecastVal ? "yes" : "no";

      // update only unresolved markets whose time has passed
      const { count } = await prisma.market.updateMany({
        where: {
          externalId,
          resolved: false,
          eventTime: { lte: now },
        },
        data: {
          resolvedOutcome: outcome,
          resolved: true,
          settledAt: new Date(),
        },
      });

      if (count > 0) settled++;
      else skipped++;
    }

    return res.status(200).json({ success: true, settled, skipped });
  } catch (err: any) {
    console.error("❌ import-results error:", err);
    return res
      .status(500)
      .json({ success: false, error: err.message });
  }
}
