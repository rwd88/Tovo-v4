// src/services/telegram.ts
import TelegramBot from 'node-telegram-bot-api'
import type { Market } from '@prisma/client'

const bot = new TelegramBot(process.env.TG_BOT_TOKEN!, { polling: false })
const CHAT_ID = process.env.TG_CHANNEL_ID!

export async function notifyNewMarkets(markets: Market[]) {
  for (const m of markets) {
    const totalPool = m.poolYes + m.poolNo
    const yesPct    = totalPool ? (m.poolYes / totalPool) * 100 : 0
    const noPct     = totalPool ? (m.poolNo  / totalPool) * 100 : 0

    const text =
      `🆕 *${m.question}*\n\n` +
      `⏰ Ends: ${m.eventTime.toUTCString()}\n` +
      `✅ ${yesPct.toFixed(1)}% Yes   ❌ ${noPct.toFixed(1)}% No\n\n` +
      `[▶️ Buy 👍/👎 position](https://your-app.com/market/${m.id})`

    await bot.sendMessage(CHAT_ID, text, { parse_mode: 'Markdown' })
  }
}
