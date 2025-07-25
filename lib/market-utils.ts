// src/lib/market-utils.ts
import { Market } from '@prisma/client'
import { sendAdminAlert } from './telegram'

/**
 * Format a new‐market announcement for Telegram.
 */
export function formatMarketMessage(market: Market): string {
  const { question, eventTime, poolYes, poolNo, forecast } = market
  const liquidity = (poolYes + poolNo).toFixed(2)
  const forecastText = forecast != null
    ? `\n📈 Forecast: ${forecast.toFixed(1)}% YES`
    : ''

  return (
    `📊 *New Prediction Market!*\n\n` +
    `*${question}*\n` +
    (eventTime
      ? `🕓 ${new Date(eventTime).toUTCString()}\n`
      : '') +
    `💰 Liquidity: $${liquidity}` +
    `${forecastText}\n\n` +
    `Make your prediction:`
  )
}

/**
 * Decide outcome from your stored “resolvedOutcome” or other logic.
 */
export function determineMarketResult(market: Market): 'YES' | 'NO' | null {
  const o = market.resolvedOutcome
  if (o === 'YES' || o === 'NO') return o
  return null
}

/**
 * Send an admin‐only alert via Telegram.
 */
export async function notifyAdmin(message: string) {
  try {
    await sendAdminAlert(message)
  } catch (err) {
    console.error('notifyAdmin failed:', err)
  }
}
