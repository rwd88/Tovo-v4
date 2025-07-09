import TelegramBot from "node-telegram-bot-api"

export const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: false })

export async function sendMarket(
  chatId: string | number,
  message: string,
  yesUrl: string,
  noUrl: string,
  options?: {
    parse_mode?: "Markdown" | "HTML"
    disable_notification?: boolean
  }
) {
  const buttons = {
    reply_markup: {
      inline_keyboard: [[
        { text: "✅ Buy YES", url: yesUrl },
        { text: "❌ Buy NO", url: noUrl }
      ]]
    },
    parse_mode: options?.parse_mode || "Markdown",
    disable_notification: options?.disable_notification,
    disable_web_page_preview: true
  } as any // <== Safely casted to bypass TS limitation

  return await bot.sendMessage(chatId, message, buttons)
}
