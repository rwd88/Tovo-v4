// pages/api/cron/publish-markets.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import bot from "../../../src/bot/bot";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Authenticate via ?secret= or Authorization: Bearer <secret>
  const authSecret =
    (req.query.secret as string) ||
    req.headers.authorization?.split(" ")[1];
  if (authSecret !== process.env.CRON_SECRET) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  try {
    // 1️⃣ Fetch all open, un-notified markets
    const openMarkets = await prisma.market.findMany({
      where: {
        status: "open",
        notified: false,         // ← was `published: false`
        question: { not: undefined },
      },
      orderBy: { eventTime: "asc" },
    });

    // 2️⃣ Get your subscribers
    const subscribers = await prisma.subscriber.findMany({
      where: { subscribed: true },
    });

    const results: Array<{
      id: string;
      question: string;
      sentCount: number;
      failedCount: number;
    }> = [];
    const failedSends: Array<{ chatId: string; error: string }> = [];

    // 3️⃣ Send each market to every subscriber
    for (const market of openMarkets) {
      if (!market.question?.trim()) {
        console.error("Skipping market with empty question:", market.id);
        continue;
      }

      const message =
        `📊 *New Prediction Market!*\n\n*${market.question}*` +
        (market.eventTime
          ? `\n🕓 ${new Date(market.eventTime).toUTCString()}`
          : "") +
        `\n💰 Liquidity: $${(
          market.poolYes + market.poolNo
        ).toFixed(2)}` +
        (market.forecast != null
          ? `\n📈 Forecast: ${market.forecast.toFixed(1)}% chance of YES`
          : "") +
        `\n\nMake your prediction:`;

      const buttons = {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "✅ YES",
                url: `${process.env.BOT_WEB_URL}/trade/${market.id}?side=yes`,
              },
              {
                text: "❌ NO",
                url: `${process.env.BOT_WEB_URL}/trade/${market.id}?side=no`,
              },
            ],
          ],
        },
        parse_mode: "Markdown" as const,
      };

      let sentCount = 0;
      let failedCount = 0;

      for (const sub of subscribers) {
        try {
          await sendWithRetry(sub.chatId, message, buttons);
          sentCount++;
        } catch (err: any) {
          console.error(`❌ Failed to send to ${sub.chatId}:`, err.message);
          failedCount++;
          failedSends.push({ chatId: sub.chatId, error: err.message });

          // If user blocked the bot, disable their subscription
          if (err.description?.includes("blocked") || err.code === 403) {
            await prisma.subscriber.update({
              where: { chatId: sub.chatId },
              data: { subscribed: false },
            });
          }
        }
      }

      // 4️⃣ Mark this market as notified so it's not sent again
      await prisma.market.update({
        where: { id: market.id },
        data: { notified: true },    // ← was `published: true`
      });

      results.push({ id: market.id, question: market.question, sentCount, failedCount });
    }

    return res.status(200).json({
      success: true,
      results,
      failedSends: failedSends.length ? failedSends : undefined,
    });
  } catch (err: any) {
    console.error("❌ publish-markets error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function sendWithRetry(
  chatId: string,
  message: string,
  buttons: any,
  retries = 2
) {
  try {
    await bot.telegram.sendMessage(chatId, message, buttons);
  } catch (err) {
    if (retries > 0) {
      // back-off before retrying
      await new Promise((r) => setTimeout(r, 1000));
      return sendWithRetry(chatId, message, buttons, retries - 1);
    }
    throw err;
  }
}
