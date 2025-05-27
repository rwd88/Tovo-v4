// lib/telegram.ts
import axios from 'axios';

export async function sendCronSummary(text: string) {
  try {
    await axios.post(
      `https://api.telegram.org/bot${process.env.TG_BOT_TOKEN}/sendMessage`,
      {
        chat_id: process.env.TG_CHANNEL_ID,
        text: `📊 ${text}`,
        parse_mode: 'Markdown'
      }
    );
  } catch (error) {
    console.error('Telegram notification failed:', error);
  }
}