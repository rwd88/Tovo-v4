// src/services/autoSettleMarkets.ts

import { PrismaClient } from '@prisma/client';
import TelegramBot from 'node-telegram-bot-api';
import { settleMarket } from './marketService'; // your existing settle logic

const prisma  = new PrismaClient();
const bot     = new TelegramBot(process.env.TG_BOT_TOKEN!, { polling: false });
const CHAT_ID = process.env.TG_CHANNEL_ID!;

/**
 * Finds all open markets that have expired, settles them,
 * then notifies the channel of each result.
 */
export async function autoSettleMarkets() {
  const now = new Date();
  // 1) Grab all markets whose eventTime ≤ now and still open
  const markets = await prisma.market.findMany({
    where: {
      eventTime: { lte: now },
      status:    'open'
    }
  });
  if (markets.length === 0) return;

  // 2) Settle each market and send a Telegram summary
  for (const m of markets) {
    try {
      // your existing function that sets m.outcome, updates pools, payouts, etc.
      const result = await settleMarket(m.id);

      // 3) Notify in Telegram
      const text = 
        `📣 *Market Settled*\n` +
        `*${m.question}*\n\n` +
        `Result: *${result.outcome.toUpperCase()}*\n` +
        `Yes pool: ${m.poolYes.toFixed(2)}  No pool: ${m.poolNo.toFixed(2)}\n` +
        `Total Payouts: ${result.totalPayout.toFixed(2)} USDC\n\n` +
        `_Settled at ${now.toUTCString()}_`;
      await bot.sendMessage(CHAT_ID, text, { parse_mode: 'Markdown' });

    } catch (err) {
      console.error('Failed to settle market', m.id, err);
    }
  }
}
