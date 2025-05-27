// lib/telegram.ts
import axios, { AxiosError } from 'axios';

interface TelegramMessage {
  chat_id: string | number;
  text: string;
  parse_mode?: 'Markdown' | 'HTML';
  disable_web_page_preview?: boolean;
}

export async function sendTelegramMessage(params: TelegramMessage) {
  try {
    if (!process.env.TG_BOT_TOKEN) {
      throw new Error('TG_BOT_TOKEN is not configured');
    }
    
    const response = await axios.post(
      `https://api.telegram.org/bot${process.env.TG_BOT_TOKEN}/sendMessage`,
      {
        chat_id: params.chat_id,
        text: params.text,
        parse_mode: params.parse_mode,
        disable_web_page_preview: true
      },
      {
        timeout: 3000,
        validateStatus: () => true // Prevent axios from throwing on 4xx/5xx
      }
    );

    if (!response.data.ok) {
      throw new Error(`Telegram API error: ${response.data.description}`);
    }

    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    console.error('Telegram send failed:', {
      config: err.config,
      response: err.response?.data,
      message: err.message
    });
    throw error;
  }
}

export async function sendAdminAlert(message: string) {
  if (!process.env.TG_ADMIN_ID) {
    console.error('ADMIN ALERT FAILED: TG_ADMIN_ID not set');
    return;
  }
  
  await sendTelegramMessage({
    chat_id: process.env.TG_ADMIN_ID,
    text: `🚨 ADMIN ALERT\n${message}`,
    parse_mode: 'Markdown'
  }).catch(() => {
    console.error('Fallback: Could not send admin alert');
  });
}

export async function sendCronSummary(text: string) {
  if (!process.env.TG_CHANNEL_ID) {
    console.error('CRON SUMMARY FAILED: TG_CHANNEL_ID not set');
    return;
  }

  await sendTelegramMessage({
    chat_id: process.env.TG_CHANNEL_ID,
    text: `📊 CRON UPDATE\n${text}`,
    parse_mode: 'Markdown'
  }).catch(() => {
    console.error('Fallback: Could not send cron summary');
  });
}