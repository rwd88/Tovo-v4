// lib/telegram/sendMarket.ts
import type { Market } from '@prisma/client';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID =
  process.env.TELEGRAM_CHANNEL_ID || process.env.TELEGRAM_CHAT_ID; // support either name
const APP_URL =
  process.env.BOT_WEB_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://tovo-v4.vercel.app';

/**
 * Very light Markdown escaper (Telegram "Markdown" mode).
 * If you switch to MarkdownV2 you must escape more characters strictly.
 */
function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

export async function sendMarketToTelegram(market: Market) {
  if (!BOT_TOKEN || !CHANNEL_ID) {
    console.warn(
      'Telegram env vars missing (TELEGRAM_BOT_TOKEN / TELEGRAM_CHANNEL_ID). Skipping market post.'
    );
    return { ok: false, skipped: true };
  }

  const totalLiquidity = Number(market.poolYes) + Number(market.poolNo);
  const forecast =
    totalLiquidity > 0 ? ((Number(market.poolYes) / totalLiquidity) * 100).toFixed(1) : '50.0';

  const question = escapeMarkdown(market.question);
  const expiryUTC = new Date(market.eventTime).toUTCString();

  const message =
    `📊 *New Prediction Market!*\n\n` +
    `*${question}*\n\n` +
    `🕒 *Expires:* ${expiryUTC} UTC\n` +
    `💰 *Liquidity:* $${totalLiquidity.toFixed(2)}\n` +
    `📈 *Forecast:* ${forecast}% chance of *YES*\n\n` +
    `Make your prediction:`;

  const payload = {
    chat_id: CHANNEL_ID,
    text: message,
    parse_mode: 'Markdown', // keep Markdown (simpler escaping)
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ YES', url: `${APP_URL}/trade/${market.id}?side=yes` },
          { text: '❌ NO', url: `${APP_URL}/trade/${market.id}?side=no` },
        ],
      ],
    },
  };

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  // Telegram returns 200 even on some errors; inspect body
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    console.warn('Telegram sendMessage failed', { status: res.status, data });
    return { ok: false, status: res.status, data };
  }

  return { ok: true, data };
}

export default sendMarketToTelegram;
