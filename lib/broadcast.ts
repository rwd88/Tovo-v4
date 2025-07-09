import { prisma } from "./prisma";
import bot from '../src/bot/bot';

interface BroadcastOptions {
  parse_mode?: "Markdown" | "HTML";
  disable_notification?: boolean;
}

export async function broadcastMarket(
  message: string, 
  options?: BroadcastOptions
) {
  try {
    const subscribers = await prisma.subscriber.findMany({
      where: { subscribed: true }
    });

    console.log(`📢 Broadcasting to ${subscribers.length} subscribers`);

    const results = {
      total: subscribers.length,
      success: 0,
      failures: [] as { chatId: string; error: string }[]
    };

    for (const user of subscribers) {
      try {
        await bot.telegram.sendMessage(
          user.chatId, 
          message, 
          {
            parse_mode: options?.parse_mode || "Markdown",
            disable_notification: options?.disable_notification,
            disable_web_page_preview: true
          }
        );
        results.success++;
      } catch (err: any) {
        console.error(`❌ Failed to send to ${user.chatId}:`, err.message);
        results.failures.push({
          chatId: user.chatId,
          error: err.message
        });

        // Auto-unsubscribe blocked users
        if (err.description?.includes('blocked') || err.code === 403) {
          await prisma.subscriber.update({
            where: { chatId: user.chatId },
            data: { subscribed: false }
          });
        }
      }
    }

    return results;
  } catch (err) {
    console.error('❌ Broadcast error:', err);
    throw err;
  }
}