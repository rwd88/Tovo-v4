export async function notifyNewMarkets(markets: Market[]) {
  for (const m of markets) {
    const text =
      `🆕 *${m.question}*\n\n` +
      `⏰ Ends: ${m.eventTime.toUTCString()}\n` +
      `✅ ${((m.poolYes/(m.poolYes+m.poolNo))*100).toFixed(1)}% Yes   ` +
      `❌ ${((m.poolNo/(m.poolYes+m.poolNo))*100).toFixed(1)}% No\n\n` +
      `[▶️ Buy 👍/👎 position](https://your-app.com/market/${m.id})`
    await bot.sendMessage(CHAT_ID, text, { parse_mode: 'Markdown' })
  }
}
