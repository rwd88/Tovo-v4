// lib/telegram.ts
import axios from 'axios';

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
        timeout: 5000, // 5-second timeout
      }
    );
    return response.data;
  } catch (error) {
    console.error('Telegram API Error:', error.response?.data || error.message);
    throw error; // Re-throw for caller to handle
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
    await sendAdminAlert(`❌ Cron summary failed: ${error.message}`);
  }
}

// For admin alerts (uses your personal ID)
export async function sendAdminAlert(message: string) {
  try {
    await sendTelegramMessage({
      chat_id: process.env.TG_ADMIN_ID!, // Your 7985574112
      text: `🚨 *ADMIN ALERT*\n${message}`,
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('FATAL: Admin alert failed:', error);
  }
}

// For formatted market announcements
export async function announceMarket(market: {
  question: string;
  eventTime: Date;
  poolYes: number;
  poolNo: number;
}) {
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