// src/lib/telegram.ts
import axios, { AxiosError, AxiosResponse } from 'axios'

/**
 * Low-level send helper
 */
interface TelegramMessage {
  chat_id: string | number
  text: string
  parse_mode?: 'Markdown' | 'HTML'
  disable_web_page_preview?: boolean
  disable_notification?: boolean
}

interface TelegramResponse {
  ok: boolean
  result: any
  description?: string
}

/**
 * sendTelegramMessage can be called either with a payload object
 * or directly with a string + optional flags.
 */
export async function sendTelegramMessage(
  params: TelegramMessage
): Promise<TelegramResponse>
export async function sendTelegramMessage(
  text: string,
  disableNotification?: boolean,
  chatId?: string
): Promise<TelegramResponse>

export async function sendTelegramMessage(
  arg1: TelegramMessage | string,
  disableNotification = false,
  chatId = process.env.TELEGRAM_CHANNEL_ID!
): Promise<TelegramResponse> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not configured')
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
        }

  const res = await axios.post<TelegramResponse>(
    `https://api.telegram.org/bot${token}/sendMessage`,
    payload,
    { timeout: 3000, validateStatus: () => true }
  )

  if (!res.data.ok) {
    throw new Error(`Telegram API error: ${res.data.description || 'unknown'}`)
  }
  return res.data
}

/**
 * sendAdminAlert → one-off alerts to your ADMIN_TELEGRAM_ID
 */
export async function sendAdminAlert(message: string): Promise<void> {
  const adminId = process.env.ADMIN_TELEGRAM_ID
  if (!adminId) {
    console.error('ADMIN ALERT FAILED: ADMIN_TELEGRAM_ID not set')
    return
  }
  try {
    await sendTelegramMessage({
      chat_id: adminId,
      text: `🚨 *ADMIN ALERT*\n${message}`,
      parse_mode: 'Markdown',
    })
  } catch (err) {
    console.error('sendAdminAlert failed:', err)
  }
}

/**
 * sendCronSummary → a daily or batch summary to TELEGRAM_CHANNEL_ID
 */
export async function sendCronSummary(text: string): Promise<void> {
  const chan = process.env.TELEGRAM_CHANNEL_ID
  if (!chan) {
    console.error('CRON SUMMARY FAILED: TELEGRAM_CHANNEL_ID not set')
    return
  }
  try {
    await sendTelegramMessage({
      chat_id: chan,
      text: `📊 *CRON UPDATE*\n${text}`,
      parse_mode: 'Markdown',
    })
  } catch (err) {
    console.error('sendCronSummary failed:', err)
  }
}
