// lib/telegram/index.ts
import axios from 'axios';

const BOT = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID;

export async function sendMessage(text: string, opts?: { parseMode?: 'Markdown' | 'HTML' }) {
  if (!BOT || !CHAT) {
    console.warn('Telegram env vars missing; skipping message.');
    return;
  }
  const url = `https://api.telegram.org/bot${BOT}/sendMessage`;
  await axios.post(url, {
    chat_id: CHAT,
    text,
    parse_mode: opts?.parseMode ?? 'Markdown',
    disable_web_page_preview: true,
  });
}
