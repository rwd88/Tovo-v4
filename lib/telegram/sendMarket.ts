import { Market } from "@prisma/client"

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID! // like @yourchannel

export async function sendMarketToTelegram(market: Market) {
  const eventTime = new Date(market.eventTime).toUTCString()

  const questionText = 
`📊 *New Prediction Market!*

*${market.question}*
🕒 ${eventTime}

Make your prediction:
✅ [YES](https://tovo-v4.vercel.app/trade/${market.id}?side=yes)   ❌ [NO](https://tovo-v4.vercel.app/trade/${market.id}?side=no)`

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`

  const payload = {
    chat_id: CHANNEL_ID,
    text: questionText,
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
