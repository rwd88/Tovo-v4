import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { parseStringPromise } from "xml2js";
import  prisma  from '../../../lib/prisma'
import { sendAdminAlert } from "../../../lib/telegram";

export const config = {
  api: { bodyParser: false },
  maxDuration: 60,
};

interface ImportResponse {
  ok: boolean;
  added: number;
  skipped: number;
  error?: string;
}

function generateQuestion(title: string): string {
  return `Will the ${title.trim()} be above forecast?`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ImportResponse>
) {
  try {
    const token =
      (req.query.secret as string) ||
      (req.headers["x-cron-secret"] as string) ||
      req.headers.authorization?.replace("Bearer ", "") ||
      "";

    if (token !== (process.env.CRON_SECRET || "12345A")) {
      await sendAdminAlert("⚠️ Unauthorized import-markets call");
      return res.status(403).json({ ok: false, added: 0, skipped: 0 });
    }

    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, added: 0, skipped: 0 });
    }

    const CAL_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.xml";
    const { data: xml } = await axios.get<string>(CAL_URL);
    const parsed = await parseStringPromise(xml, {
      explicitArray: false,
      trim: true,
    });

    const raw = parsed?.weeklyevents?.event;
    const events: any[] = raw ? (Array.isArray(raw) ? raw : [raw]) : [];

    let added = 0;
    let skipped = 0;
    const now = Date.now();

    for (const ev of events) {
      if (ev.impact?.trim().toLowerCase() !== "high") {
        skipped++;
        continue;
      }

      const dateStr = ev.date?.trim();
      const t = ev.time?.trim().toLowerCase();
      if (!dateStr || !t) {
        skipped++;
        continue;
      }

      const m = t.match(/^(\d{1,2}):(\d{2})(am|pm)$/);
      if (!m) {
        skipped++;
        continue;
      }
      let hour = parseInt(m[1], 10);
      if (m[3] === "pm" && hour < 12) hour += 12;
      if (m[3] === "am" && hour === 12) hour = 0;
      const minute = m[2];
      const [mm, dd, yyyy] = dateStr.split("-");
      const iso = `${yyyy}-${mm}-${dd}T${hour.toString().padStart(2, "0")}:${minute}:00Z`;
      const eventTime = new Date(iso);
      if (isNaN(eventTime.getTime()) || eventTime.getTime() < now) {
        skipped++;
        continue;
      }

      const rawForecast = ev.forecast?.trim();
      const forecastVal =
        rawForecast && !isNaN(Number(rawForecast))
          ? parseFloat(rawForecast)
          : null;

      const externalId =
        ev.url?.trim() || `ff-${ev.title}-${mm}${dd}-${hour}${minute}`;

      const originalTitle = ev.title?.trim() || "";
      const naturalQuestion = generateQuestion(originalTitle);

      await prisma.market.upsert({
        where: { externalId },
        update: {
          ...(forecastVal != null ? { forecast: forecastVal } : {}),
        },
        create: {
          externalId,
          question: naturalQuestion,
          status: "open",
          eventTime,
          poolYes: 1,
          poolNo: 1,
          notified: false,
          resolved: false,
          ...(forecastVal != null ? { forecast: forecastVal } : {}),
        },
      });

      added++;
    }

    return res.status(200).json({ ok: true, added, skipped });
  } catch (err: any) {
    console.error("❌ import-markets failed", err);
    await sendAdminAlert(`import-markets crashed: ${err.message}`);
    return res
      .status(500)
      .json({ ok: false, added: 0, skipped: 0, error: err.message });
  }
}
