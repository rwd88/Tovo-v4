// lib/telegram/sendMarket.ts
import { Market } from "@prisma/client"

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID! // like @yourchannel

export async function sendMarketToTelegram(market: Market) {
  const question = `📊 *New Market:*\n\n*${market.question}*\n\n[Buy YES](https://t.me/YOUR_BOT?start=yes_${market.id}) | [Buy NO](https://t.me/YOUR_BOT?start=no_${market.id})`

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`
  const payload = {
    chat_id: CHANNEL_ID,
    text: question,
    parse_mode: "Markdown",
    disable_web_page_preview: true,
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  return res.json()
}
