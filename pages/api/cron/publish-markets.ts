import type { NextApiRequest, NextApiResponse } from "next";
import  prisma  from '../../../lib/prisma'
import { sendTelegramMessage, sendAdminAlert } from "../../../lib/telegram";
import { formatMarketHtml } from "../../../lib/market-utils";

interface PublishResponse {
  ok: boolean;
  published: number;
  id?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PublishResponse>
) {
  try {
    const token =
      (req.query.secret as string) ||
      req.headers.authorization?.replace("Bearer ", "") ||
      "";

    if (token !== (process.env.CRON_SECRET || "12345A")) {
      await sendAdminAlert("⚠️ Unauthorized publish-markets call");
      return res.status(403).json({ ok: false, published: 0 });
    }

    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, published: 0 });
    }

    // 1️⃣ Pick the next un-notified market
    const m = await prisma.market.findFirst({
      where: {
        status: "open",
        notified: false,
        eventTime: { gt: new Date() },
      },
      orderBy: { eventTime: "asc" },
    });

    if (!m) {
      return res.status(200).json({ ok: true, published: 0 });
    }

    // 2️⃣ Build HTML block
    const coreHtml = formatMarketHtml(m);
    const baseUrl = (process.env.BOT_WEB_URL || "").replace(/\/$/, "");
    const yesUrl = `${baseUrl}/trade/${m.id}?side=yes`;
    const noUrl = `${baseUrl}/trade/${m.id}?side=no`;

    const fullHtml = `
${coreHtml}

<a href="${yesUrl}">✅ Trade YES</a>   <a href="${noUrl}">❌ Trade NO</a>
`.trim();

    // 3️⃣ Send to Telegram
    await sendTelegramMessage({
      chat_id: process.env.TELEGRAM_CHANNEL_ID!,
      text: fullHtml,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: JSON.stringify({
        inline_keyboard: [
          [
            { text: "✅ Trade YES", url: yesUrl },
            { text: "❌ Trade NO", url: noUrl },
          ],
        ],
      }),
    });

    // 4️⃣ Mark as notified
    await prisma.market.update({
      where: { id: m.id },
      data: { notified: true },
    });

    return res.status(200).json({ ok: true, published: 1, id: m.id });
  } catch (err: any) {
    console.error("❌ publish-markets failed", err);
    await sendAdminAlert(`publish-markets crashed: ${err.message}`);
    return res
      .status(500)
      .json({ ok: false, published: 0, error: err.message });
  }
}
