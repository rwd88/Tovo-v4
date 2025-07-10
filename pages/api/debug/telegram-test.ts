// pages/api/debug/telegram-test.ts

import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
    const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID!;

    const telegramRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHANNEL_ID,
        text: '✅ Tovo Bot Test: Message successfully sent to channel!',
      }),
    });

    const data = await telegramRes.json();

    return res.status(200).json({ sent: true, telegramResponse: data });
  } catch (err) {
    return res.status(500).json({ sent: false, error: err });
  }
}
