// src/lib/market-utils.ts
import type { Market } from '@prisma/client'

/** Escape `<`, `>`, `&` for safe HTML injection */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Turn a Market row into the core HTML block (without the keyboard).
 * You can still call this if you need to re‐use elsewhere.
 */
export function formatMarketHtml(m: Market): string {
  // 1) Normalize question to “Will …?”
  let q = m.question.trim()
  if (!/^Will\s/i.test(q)) {
    q = `Will ${q.replace(/\?$/,'')}?`
  }
  const questionEsc = escapeHtml(q)

  // 2) Pools / percentages
  const totalPool = m.poolYes + m.poolNo
  const yesPct    = totalPool ? (m.poolYes / totalPool) * 100 : 0
  const noPct     = totalPool ? (m.poolNo  / totalPool) * 100 : 0

  // 3) Forecast line (optional)
  const forecastLine = m.forecast != null
    ? `\n<b>📈 Forecast:</b> ${m.forecast.toFixed(1)}% YES\n`
    : '\n'

  // 4) Build the block
  return `
<b>📊 New Prediction Market!</b>
<b>${questionEsc}</b>
<i>⏰ Expires: ${m.eventTime.toUTCString()}</i>
<b>👍 ${yesPct.toFixed(1)}% Yes   –   👎 ${noPct.toFixed(1)}% No</b>
💰 ${totalPool.toFixed(2)} USDC${forecastLine}
`.trim()
}
