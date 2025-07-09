// src/bot/telegram.ts
import TelegramBot from "node-telegram-bot-api";

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN is not defined in .env");
}

export const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
  polling: false
});
