import TelegramBot from "node-telegram-bot-api"

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: false })

export async function sendMarketMessage(chatId: string, message: string, buttons?: TelegramBot.SendMessageOptions) {
  try {
    await bot.sendMessage(chatId, message, buttons)
    console.log("Message sent to", chatId)
  } catch (err) {
    console.error("Failed to send message to", chatId, err)
  }
}
