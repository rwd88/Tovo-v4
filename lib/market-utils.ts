// src/lib/market-utils.ts
import type { Market } from "@prisma/client"

export function formatMarketMessage(m: Market): string {
  // 1) Normalize question to “Will …?”
  let q = m.question.trim()
  if (!/^Will\s/i.test(q)) {
    q = `Will ${q.replace(/\?$/,'')}?`
  }

  // 2) Pools & percentages
  const totalPool = m.poolYes + m.poolNo
  const yesPct    = totalPool ? (m.poolYes / totalPool) * 100 : 0
  const noPct     = totalPool ? (m.poolNo  / totalPool) * 100 : 0

  // 3) Time‐left and “as of”
  const now       = new Date()
  const endsInMs  = m.eventTime.getTime() - now.getTime()
  const days      = Math.floor(endsInMs / (1000*60*60*24))
  const hours     = Math.floor((endsInMs % (1000*60*60*24)) / (1000*60*60))
  const asOf       = now.toISOString().replace('T',' ').replace(/\..+$/,'')

  // 4) Build lines
  const lines = [
    `📊 *New Prediction Market!*`,
    ``,
    `*${q}*`,
    ``,
    `👍 ${yesPct.toFixed(1)}% Yes   –   👎 ${noPct.toFixed(1)}% No`,
    `💰 ${totalPool.toFixed(2)} USDC`,
    `⏰ Ends in ${days} day${days!==1?'s':''} ${hours} hour${hours!==1?'s':''}`,
    `(as of ${asOf} UTC)`,
    ``,
    `This market will resolve to *YES* if the price of your asset meets the condition at the specified time.`,
    ``,
    `Buy 👍 / 👎 position`,
    ``,
    `Powered by Limitless.Exchange and @moaicash_bot.`,
    ``,
    `#weekly #lumy #recurring`
  ]

  return lines.join("\n")
}
