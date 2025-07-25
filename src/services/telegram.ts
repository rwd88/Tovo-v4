import axios from 'axios'
import type { Market } from '@prisma/client'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID  = process.env.TELEGRAM_CHANNEL_ID

if (!BOT_TOKEN || !CHAT_ID) {
  throw new Error('Missing Telegram env vars: TELEGRAM_BOT_TOKEN and/or TELEGRAM_CHANNEL_ID')
}

/**
 * Send a batch of new markets to Telegram.
 */
export async function notifyNewMarkets(markets: Market[]) {
  for (const m of markets) {
    const totalPool = m.poolYes + m.poolNo
    const yesPct    = totalPool ? (m.poolYes / totalPool) * 100 : 0
    const noPct     = totalPool ? (m.poolNo  / totalPool) * 100 : 0

    const text =
      `🆕 *${m.question}*\n` +
      `⏰ Ends: ${m.eventTime.toUTCString()}\n` +
      `✅ ${yesPct.toFixed(1)}% Yes   ❌ ${noPct.toFixed(1)}% No\n\n` +
      `[▶️ Buy 👍/👎 position](https://your-app.com/market/${m.id})`

    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        chat_id:    CHAT_ID,
        text,
        parse_mode: 'Markdown',
      }
    )
  }
}
