// src/lib/market-utils.ts
import type { Market } from '@prisma/client'

export function formatMarketMessage(m: Market): string {
  // Normalize the question to “Will …?”
  let q = m.question.trim()
  if (!/^Will\s/i.test(q)) {
    q = `Will ${q.replace(/\?$/,'')}?`
  }

  // Compute pool and percentages
  const totalPool = m.poolYes + m.poolNo
  const yesPct    = totalPool ? (m.poolYes / totalPool) * 100 : 0
  const noPct     = totalPool ? (m.poolNo  / totalPool) * 100 : 0

  const lines = [
    `📊 *New Prediction Market!*`,
    ``,
    `*${q}*`,
    ``,
    `⏰ Expires: ${m.eventTime.toUTCString()}`,
    `💰 Liquidity: $${totalPool.toFixed(2)}`,
    `✅ ${yesPct.toFixed(1)}% YES   ❌ ${noPct.toFixed(1)}% NO`,
    m.forecast != null ? `📈 Forecast: ${m.forecast.toFixed(1)}% YES` : null,
    ``,
    `Make your prediction below:`
  ]

  return lines.filter(Boolean).join('\n')
}
