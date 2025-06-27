// src/services/autoSettleMarkets.ts

import { PrismaClient } from '@prisma/client'
import TelegramBot from 'node-telegram-bot-api'

const prisma = new PrismaClient()
const bot = new TelegramBot(process.env.TG_BOT_TOKEN!, { polling: false })
const CHAT_ID = process.env.TG_CHANNEL_ID!

export async function autoSettleMarkets() {
  const now = new Date()
  // 1) find ready-to-settle markets
  const markets = await prisma.market.findMany({
    where: {
      eventTime: { lte: now },
      status:    'open',
      outcome:   { not: null },
    },
    include: { trades: true },
  })

  let totalSettled = 0
  let totalProfit  = 0

  for (const market of markets) {
    const winning = (market.outcome ?? '').toUpperCase()
    if (!['YES','NO'].includes(winning)) {
      // just close it
      await prisma.market.update({
        where: { id: market.id },
        data:  { status: 'settled' },
      })
      continue
    }

    const winPool    = winning === 'YES' ? market.poolYes : market.poolNo
    const winners    = market.trades.filter(t => t.type?.toUpperCase() === winning)
    const totalPool  = market.poolYes + market.poolNo
    const tradingFee = totalPool * 0.01 * 2
    const houseCut   = totalPool * 0.1
    const netPool    = totalPool - tradingFee - houseCut
    const shareFactor= winPool > 0 ? netPool / winPool : 0

    // batch DB updates
    const txs: any[] = []
    // 1) pay out winners
    for (const t of winners) {
      const profit = t.amount * shareFactor - (t.fee ?? 0)
      txs.push(
        prisma.user.update({
          where: { id: t.userId },
          data:  { balance: { increment: profit } },
        })
      )
    }
    // 2) mark winning trades settled
    txs.push(
      prisma.trade.updateMany({
        where: { marketId: market.id, type: winning },
        data:  { settled: true },
      })
    )
    // 3) close the market
    txs.push(
      prisma.market.update({
        where: { id: market.id },
        data:  { status: 'settled' },
      })
    )

    await prisma.$transaction(txs)
    totalSettled++
    totalProfit += houseCut
  }

  // 4) send Telegram summary
  const nextRun = new Date(Date.now() + 24*60*60*1000).toUTCString()
  const text = 
    `🏦 Settlement Complete\n` +
    `• Markets settled: ${totalSettled}\n` +
    `• House profit: $${totalProfit.toFixed(2)}\n` +
    `⌛ Next: ${nextRun}`
  await bot.sendMessage(CHAT_ID, text, { parse_mode: 'Markdown' })
}
