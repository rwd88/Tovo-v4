// src/lib/telegram.ts
import axios, { AxiosError, AxiosResponse } from 'axios';

interface TelegramMessage {
  chat_id: string | number;
  text: string;
  parse_mode?: 'Markdown' | 'HTML';
  disable_web_page_preview?: boolean;
  disable_notification?: boolean;
}

interface TelegramResponse {
  ok: boolean;
  result: any;
  description?: string;
}

export async function sendTelegramMessage(
  params: TelegramMessage
): Promise<TelegramResponse>;
export async function sendTelegramMessage(
  text: string,
  disableNotification?: boolean,
  chatId?: string
): Promise<TelegramResponse>;

export async function sendTelegramMessage(
  arg1: TelegramMessage | string,
  disableNotification = false,
  chatId = process.env.TG_CHANNEL_ID!
): Promise<TelegramResponse> {
  if (!process.env.TG_BOT_TOKEN) {
    throw new Error('TG_BOT_TOKEN is not configured');
  }

  const payload: TelegramMessage =
    typeof arg1 === 'string'
      ? {
          chat_id: chatId,
          text: arg1,
          parse_mode: 'Markdown',
          disable_notification: disableNotification,
          disable_web_page_preview: true,
        }
      : {
          ...arg1,
          disable_web_page_preview: true,
          parse_mode: arg1.parse_mode ?? 'Markdown',
        };

  const res = await axios.post<TelegramResponse>(
    `https://api.telegram.org/bot${process.env.TG_BOT_TOKEN}/sendMessage`,
    payload,
    { timeout: 3000, validateStatus: () => true }
  );

  if (!res.data.ok) {
    throw new Error(`Telegram API error: ${res.data.description}`);
  }
  return res.data;
}

export async function sendAdminAlert(message: string): Promise<void> {
  if (!process.env.TG_ADMIN_ID) {
    console.error('ADMIN ALERT FAILED: TG_ADMIN_ID not set');
    return;
  }
  try {
    await sendTelegramMessage({
      chat_id: process.env.TG_ADMIN_ID,
      text: `🚨 *ADMIN ALERT*\n${message}`,
      parse_mode: 'Markdown',
    });
  } catch (err) {
    console.error('sendAdminAlert failed:', err);
  }
}

export async function sendCronSummary(text: string): Promise<void> {
  if (!process.env.TG_CHANNEL_ID) {
    console.error('CRON SUMMARY FAILED: TG_CHANNEL_ID not set');
    return;
  }
  try {
    await sendTelegramMessage({
      chat_id: process.env.TG_CHANNEL_ID,
      text: `📊 *CRON UPDATE*\n${text}`,
      parse_mode: 'Markdown',
    });
  } catch (err) {
    console.error('sendCronSummary failed:', err);
  }
}
