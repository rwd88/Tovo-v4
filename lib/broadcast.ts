import { prisma } from "./prisma";
import { bot } from "../bot/telegram"; // assuming you use telegraf

export async function broadcastMarket(message: string) {
  const subscribers = await prisma.subscriber.findMany();
  for (const user of subscribers) {
    try {
      await bot.telegram.sendMessage(user.chatId, message, {
        parse_mode: "Markdown",
      });
    } catch (err) {
      console.error(`Failed to send to ${user.chatId}:`, err.message);
    }
  }
}
