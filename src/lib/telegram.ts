// src/lib/telegram.ts
import { Telegraf } from 'telegraf'
import type { Context } from 'telegraf'
import { PrismaClient } from '@prisma/client'

// shared Prisma client just in case your bot uses it
const prisma = new PrismaClient()

// create & export the bot instance
export const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!)

/**
 * Send a one-off message to your admin (for cron summaries or errors).
 */
export async function sendAdminNotification(text: string) {
  const adminId = process.env.ADMIN_TELEGRAM_ID
  if (!adminId) return

  try {
    await bot.telegram.sendMessage(adminId, text, { parse_mode: 'Markdown' })
  } catch (err) {
    console.error('sendAdminNotification error:', err)
  }
}

// (Optional) export a helper to start the bot in serverless environments
export function startBot() {
  bot.launch().catch(console.error)
}
