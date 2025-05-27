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
    const response = await axios.post(
      `https://api.telegram.org/bot${process.env.TG_BOT_TOKEN}/sendMessage`,
      {
        ...params,
        disable_web_page_preview: true,
      },
      {
        timeout: 5000,
      }
    );
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    console.error('Telegram API Error:', axiosError.response?.data || axiosError.message);
    throw error;
  }
}

// For public channel updates
export async function sendCronSummary(text: string) {
  try {
    await sendTelegramMessage({
      chat_id: process.env.TG_CHANNEL_ID!,
      text: `📊 *Cron Update*\n${text}`,
      parse_mode: 'Markdown'
    });
  } catch (error) {
    const err = error as Error;
    await sendAdminAlert(`❌ Cron summary failed: ${err.message}`);
  }
}

// For admin alerts
export async function sendAdminAlert(message: string) {
  try {
    await sendTelegramMessage({
      chat_id: process.env.TG_ADMIN_ID!,
      text: `🚨 *ADMIN ALERT*\n${message}`,
      parse_mode: 'Markdown'
    });
  } catch (error) {
    const err = error as Error;
    console.error('FATAL: Admin alert failed:', err);
  }
}

// Type-safe market announcement
interface MarketAnnouncement {
  question: string;
  eventTime: Date;
  poolYes: number;
  poolNo: number;
}

export async function announceMarket(market: MarketAnnouncement) {
  await sendTelegramMessage({
    chat_id: process.env.TG_CHANNEL_ID!,
    text: `🎯 *New Prediction Market*  
❓ ${market.question}  
⏱️ Ends: ${market.eventTime.toUTCString()}  
✅ YES: $${market.poolYes.toFixed(2)}  
❌ NO: $${market.poolNo.toFixed(2)}  
👉 /predict`,
    parse_mode: 'Markdown'
  });
}