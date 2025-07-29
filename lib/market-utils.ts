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
    forecastText
  )
}

export function determineMarketResult(market: Market): 'YES' | 'NO' | null {
  return market.resolvedOutcome === 'YES' || market.resolvedOutcome === 'NO' 
    ? market.resolvedOutcome 
    : null
}

export async function notifyAdmin(message: string): Promise<void> {
  console.log('[TELEGRAM OUTGOING]', message)
  try {
    const startTime = Date.now()
    await sendAdminAlert(message)
    console.log(`[TELEGRAM SUCCESS] ${Date.now() - startTime}ms`)
  } catch (err) {
    console.error('[TELEGRAM FAILURE]', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    })
    throw err // Propagate error to caller
  }
}