// lib/market-utils.ts
import { Market } from '@prisma/client'
import { bot } from './telegram' // Make sure this import exists

export function formatMarketMessage(market: Market): string {
  const { question, eventTime, poolYes, poolNo, forecast } = market
  const liquidity = (poolYes + poolNo).toFixed(2)
  const forecastText = forecast != null ? `\n📈 Forecast: ${forecast.toFixed(1)}% YES` : ''
  
  return `📊 *New Prediction Market!*\n\n` +
         `*${question}*\n` +
         `${eventTime ? `🕓 ${new Date(eventTime).toUTCString()}\n` : ''}` +
         `💰 Liquidity: $${liquidity}` +
         `${forecastText}\n\n` +
         `Make your prediction:`
}

export function determineMarketResult(market: Market): 'YES' | 'NO' | null {
  // Implement your actual market resolution logic here
  // This is just a placeholder - replace with your real logic
  if (market.resolvedOutcome === 'YES' || market.resolvedOutcome === 'NO') {
    return market.resolvedOutcome
  }
  return null
}

export async function notifyAdmin(message: string) {
  if (!process.env.ADMIN_TELEGRAM_ID) return
  
  try {
    await bot.telegram.sendMessage(
      process.env.ADMIN_TELEGRAM_ID,
      `⚠️ Admin Alert:\n${message}`,
      { parse_mode: 'Markdown' }
    )
  } catch (err) {
    console.error('Failed to notify admin:', err)
  }
}