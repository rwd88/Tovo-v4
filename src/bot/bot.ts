/* eslint-disable @typescript-eslint/no-explicit-any */
import { Telegraf, Markup } from 'telegraf'
import type { Message } from 'telegraf/typings/core/types/typegram'
import { PrismaClient } from '@prisma/client'

// Initialize Prisma and Telegraf
const prisma = new PrismaClient()
const bot = new Telegraf(process.env.TG_BOT_TOKEN!) 

// Constants
const TRADE_FEE = 0.01  // 1% fee

// Helpers
function calculateShares(poolSize: number, amount: number): number {
  return poolSize === 0 ? amount : (amount * poolSize) / (amount + poolSize)
}
function isValidSolanaAddress(addr: string): boolean {
  return /^[A-HJ-NP-Za-km-z1-9]{32,44}$/.test(addr)
}

// /start
bot.start(ctx => {
  ctx.reply(
    `👋 Welcome to *Tovo*, the prediction market bot!\n\n` +
    `Use /listpools to see active markets or /balance to check your funds.`,
    { parse_mode: 'Markdown' }
  )
})

// /listpools
bot.command('listpools', async ctx => {
  const markets = await prisma.market.findMany({
    where: { status: 'open' },
    orderBy: { eventTime: 'asc' },
  })
  if (!markets.length) {
    return ctx.reply('No active markets found. Check back later!')
  }
  for (const m of markets) {
    await ctx.replyWithMarkdown(
      `📊 *${m.question}*\n⏰ ${m.eventTime.toUTCString()}\n` +
      `🟢 YES: $${m.poolYes.toFixed(2)} | 🔴 NO: $${m.poolNo.toFixed(2)}`,
      Markup.inlineKeyboard([[
        Markup.button.callback('Bet YES', `bet_yes_${m.id}`),
        Markup.button.callback('Bet NO',  `bet_no_${m.id}`)
      ]])
    )
  }
})

// /balance
bot.command('balance', async ctx => {
  const user = await prisma.user.findUnique({
    where: { telegramId: ctx.from.id.toString() }
  })
  ctx.reply(`💰 Your balance: $${user?.balance.toFixed(2) || '0.00'}`)
})

// /link_solana <addr>
bot.command('link_solana', async ctx => {
  const parts = (ctx.message as any).text.split(' ').slice(1)
  const address = parts[0]?.trim()
  if (!address) return ctx.reply('Usage: /link_solana <Solana address>')
  if (!isValidSolanaAddress(address)) {
    return ctx.reply('❌ That doesn’t look like a valid Solana address.')
  }
  try {
    await prisma.user.upsert({
      where: { telegramId: ctx.from.id.toString() },
      update: { solanaWallet: address },
      create: {
        id:           ctx.from.id.toString(),
        telegramId:   ctx.from.id.toString(),
        balance:      0,
        solanaWallet: address,
      }
    })
    ctx.reply(`✅ Linked your Solana wallet: \`${address}\``)
  } catch {
    ctx.reply('❌ Couldn’t link your Solana wallet. Try again later.')
  }
})

// /link_bsc <addr>
bot.command('link_bsc', async ctx => {
  const parts = (ctx.message as any).text.split(' ').slice(1)
  const address = parts[0]?.trim()
  if (!address) return ctx.reply('Usage: /link_bsc <BSC address>')
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return ctx.reply('❌ That doesn’t look like a valid BSC address.')
  }
  try {
    await prisma.user.upsert({
      where: { telegramId: ctx.from.id.toString() },
      update: { bscWallet: address },
      create: {
        id:         ctx.from.id.toString(),
        telegramId: ctx.from.id.toString(),
        balance:    0,
        bscWallet:  address,
      }
    })
    ctx.reply(`✅ Linked your BSC wallet: \`${address}\``)
  } catch {
    ctx.reply('❌ Couldn’t link your BSC wallet. Try again later.')
  }
})

// Bet callbacks
bot.action(/bet_(yes|no)_(.+)/, async ctx => {
  const [, side, marketId] = ctx.match as [string, string, string]
  const userId = ctx.from.id.toString()
  const betAmount = 10

  const market = await prisma.market.findUnique({ where: { id: marketId } })
  if (!market || market.status !== 'open') {
    return ctx.answerCbQuery('Market closed or invalid!')
  }

  const user = await prisma.user.upsert({
    where: { telegramId: userId },
    create: { id: userId, telegramId: userId, balance: 100 },
    update: {}
  })
  if (user.balance < betAmount) {
    return ctx.answerCbQuery('Insufficient balance!')
  }

  const fee = betAmount * TRADE_FEE
  const amountAfterFee = betAmount - fee
  const pool = side === 'yes' ? market.poolYes : market.poolNo
  const shares = calculateShares(pool, amountAfterFee)

  await prisma.$transaction([
    prisma.market.update({
      where: { id: marketId },
      data: {
        [`pool${side.toUpperCase()}`]: { increment: amountAfterFee },
        feeCollected:                  { increment: fee },
      }
    }),
    prisma.trade.create({
      data: { userId, marketId, type: side, amount: betAmount, fee, shares, payout: 0 }
    }),
    prisma.user.update({
      where: { telegramId: userId },
      data: { balance: { decrement: betAmount } }
    }),
  ])

  const orig = ctx.callbackQuery.message as Message.TextMessage
  await ctx.editMessageText(
    `${orig.text}\n\n✅ @${ctx.from.username} bet $${betAmount} on ${side.toUpperCase()}!` +
    ` (Shares: ${shares.toFixed(2)}, Fee: $${fee.toFixed(2)})`
  )
})

// Export only—do NOT bot.launch() here
export default bot
