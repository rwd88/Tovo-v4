// lib/telegram/sendMarket.ts
import { Market } from "@prisma/client"

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID! // should be "@tovotrade"

export async function sendMarketToTelegram(market: Market) {
  const question = `📊 *New Prediction Market!*\n\n${market.question}\n🕓 ${market.eventTime.toUTCString()}\n\nMake your prediction:`

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`
  const payload = {
    chat_id: CHANNEL_ID,
    text: question,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ YES", url: `https://tovo-v4.vercel.app/trade/${market.id}?side=yes` },
          { text: "❌ NO", url: `https://tovo-v4.vercel.app/trade/${market.id}?side=no` }
        ]
      ]
    }
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  return res.json()
}
