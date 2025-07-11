// src/services/autoSettleMarkets.ts

import { PrismaClient } from '@prisma/client'
import TelegramBot from 'node-telegram-bot-api'

const prisma = new PrismaClient()
const bot    = new TelegramBot(process.env.TG_BOT_TOKEN!, { polling: false })
const CHAT_ID = process.env.TG_CHANNEL_ID!

export async function autoSettleMarkets() {
  const now = new Date()

  // 1) find ready-to-settle markets (use resolvedOutcome, not outcome)
  const markets = await prisma.market.findMany({
    where: {
      eventTime:      { lte: now },
      status:         'open',
      resolved:       true,                // only those you’ve already flagged as resolved
      resolvedOutcome: { not: null },      // use this field name
    },
    include: { trades: true },
  })

  let totalSettled = 0
  let totalProfit  = 0

  for (const market of markets) {
    const winning = market.resolvedOutcome!.toUpperCase()  // YES or NO

    // If somehow it isn’t YES/NO, just close the market
    if (!['YES','NO'].includes(winning)) {
      await prisma.market.update({
        where: { id: market.id },
        data:  { status: 'settled' },
      })
      continue
    }

    // Pools and fees
    const winPool    = winning === 'YES' ? market.poolYes : market.poolNo
    const totalPool  = market.poolYes + market.poolNo
    const tradingFee = totalPool * 0.01 * 2
    const houseCut   = totalPool * 0.1
    const netPool    = totalPool - tradingFee - houseCut
    const shareFactor= winPool > 0 ? netPool / winPool : 0

    // Build transaction array
    const txs: any[] = []

    // 2) pay out winners
    for (const t of market.trades.filter(t => t.type.toUpperCase() === winning)) {
      const profit = t.amount * shareFactor - (t.fee ?? 0)
      txs.push(
        prisma.user.update({
          where: { id: t.userId },
          data:  { balance: { increment: profit } },
        })
      )
    }

    // 3) mark all trades settled
    txs.push(
      prisma.trade.updateMany({
        where: { marketId: market.id },
        data:  { settled: true },
      })
    )

    // 4) close the market
    txs.push(
      prisma.market.update({
        where: { id: market.id },
        data:  { status: 'settled' },
      })
    )

    // 5) commit in one transaction
    await prisma.$transaction(txs)

    totalSettled++
    totalProfit += houseCut
  }

  // 6) send Telegram summary
  const nextRun = new Date(Date.now() + 24*60*60*1000).toUTCString()
  const text =
    `🏦 Settlement Complete\n` +
    `• Markets settled: ${totalSettled}\n` +
    `• House profit: $${totalProfit.toFixed(2)}\n` +
    `⌛ Next: ${nextRun}`

  await bot.sendMessage(CHAT_ID, text, { parse_mode: 'Markdown' })
}
