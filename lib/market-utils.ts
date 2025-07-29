import { Market } from '@prisma/client'
import { sendAdminAlert } from './telegram'

export function formatMarketMessage(market: Market): string {
  const { question, eventTime, poolYes, poolNo, forecast } = market
  const liquidity = (poolYes + poolNo).toFixed(2)
  const forecastText = forecast != null
    ? `\n📈 Forecast: ${forecast.toFixed(1)}% YES`
    : ''

  return (
    `📊 *New Prediction Market!*\n\n` +
    `*${question}*\n` +
    (eventTime ? `🕓 ${new Date(eventTime).toUTCString()}\n` : '') +
    `💰 Liquidity: $${liquidity}` +
    `${forecastText}`
  )
}

export function determineMarketResult(market: Market): 'YES' | 'NO' | null {
  return market.resolvedOutcome === 'YES' || market.resolvedOutcome === 'NO' 
    ? market.resolvedOutcome 
    : null
}

export async function notifyAdmin(message: string) {
  console.log('[Telegram] Attempting to send:', message)
  try {
    await sendAdminAlert(`🔔 ${message}`)
    console.log('[Telegram] Notification sent successfully')
  } catch (err) {
    console.error('[Telegram] Failed to send:', err)
    throw err // Re-throw to handle in parent function
  }
}