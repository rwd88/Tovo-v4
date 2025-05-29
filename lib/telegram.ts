import axios, { AxiosError } from 'axios';

interface TelegramMessage {
  chat_id: string | number;
  text: string;
  parse_mode?: 'Markdown' | 'HTML';
  disable_web_page_preview?: boolean;
  disable_notification?: boolean;
}

// Overload signatures
export async function sendTelegramMessage(params: TelegramMessage): Promise<any>;
export async function sendTelegramMessage(
  text: string,
  disableNotification?: boolean,
  chatId?: string
): Promise<any>;

// Implementation
export async function sendTelegramMessage(
  arg1: TelegramMessage | string,
  disableNotification = false,
  chatId = process.env.TG_CHANNEL_ID!
): Promise<any> {
  try {
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
            disable_web_page_preview: true
          }
        : {
            ...arg1,
            disable_web_page_preview: true,
            parse_mode: arg1.parse_mode ?? 'Markdown'
          };

    const response = await axios.post(
      `https://api.telegram.org/bot${process.env.TG_BOT_TOKEN}/sendMessage`,
      payload,
      {
        timeout: 3000,
        validateStatus: () => true
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
