import { Telegraf } from 'telegraf'
import type { Context } from 'telegraf'

export const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!)

// Send to public channel
export async function sendToChannel(text: string, options?: any) {
  try {
    await bot.telegram.sendMessage(
      process.env.TELEGRAM_CHANNEL_ID!, 
      text, 
      { parse_mode: 'Markdown', ...options }
    )
  } catch (err) {
    console.error('Channel send failed:', err)
  }
}

// Send to admin only
export async function sendAdminAlert(text: string) {
  try {
    await bot.telegram.sendMessage(
      process.env.ADMIN_TELEGRAM_ID!, 
      `⚠️ ADMIN: ${text}`,
      { parse_mode: 'Markdown' }
    )
  } catch (err) {
    console.error('Admin alert failed:', err)
  }
}

// Start bot (for serverless)
export function startBot() {
  bot.launch().catch(console.error)
}