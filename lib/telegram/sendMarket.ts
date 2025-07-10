import { Market } from "@prisma/client"

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID!
const BOT_WEB_URL = process.env.BOT_WEB_URL ?? "https://tovo-v4.vercel.app"

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&')
}

export async function sendMarketToTelegram(market: Market) {
  const totalLiquidity = market.poolYes + market.poolNo
  const forecast = totalLiquidity > 0
    ? ((market.poolYes / totalLiquidity) * 100).toFixed(1)
    : "50.0"

  const question = escapeMarkdown(market.question)
  const expiry = new Date(market.eventTime).toUTCString()

  const message = `📊 *New Prediction Market!*\n\n` +
    `*${question}*\n\n` +
    `🕒 *Expires:* ${expiry} UTC\n` +
    `💰 *Liquidity:* $${totalLiquidity.toFixed(2)}\n` +
    `📈 *Forecast:* ${forecast}% chance of *YES*\n\n` +
    `Make your prediction:`

  const payload = {
    chat_id: CHANNEL_ID,
    text: message,
    parse_mode: "Markdown",
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ YES", url: `${BOT_WEB_URL}/trade/${market.id}?side=yes` },
          { text: "❌ NO", url: `${BOT_WEB_URL}/trade/${market.id}?side=no` }
        ]
      ]
    }
  }

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  return res.json()
}
