// src/lib/market-utils.ts
import type { Market } from '@prisma/client'

/**
 * Build the Markdown text for a new‐market Telegram post.
 */
export function formatMarketMessage(market: Market): string {
  // Ensure the question reads as a full “Will …?” question
  let q = market.question.trim()
  if (!/^Will\s/i.test(q)) {
    // Prefix “Will ” and append “?” if not already present
    q = `Will ${q.replace(/\?$/,'')}?`
  }

  const totalPool = market.poolYes + market.poolNo
  const forecastPct = market.forecast != null
    ? `${market.forecast.toFixed(1)}% YES`
    : null

  return [
    `📊 *New Prediction Market!*`,
    ``,
    `*${q}*`,
    ``,
    `⏰ Expires: ${market.eventTime.toUTCString()}`,
    `💰 Liquidity: $${totalPool.toFixed(2)}`,
    forecastPct ? `📈 Forecast: ${forecastPct}` : null,
    ``,
    `Make your prediction below:`
  ]
    .filter(Boolean)
    .join('\n')
}
