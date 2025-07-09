// src/bot/telegram.ts
import { Telegraf } from 'telegraf'

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!)

// Middleware and handlers would go here
// bot.use(...)
// bot.command(...)

export { bot }