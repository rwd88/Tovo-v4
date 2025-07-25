// src/bot/bots.ts
import { Telegraf, Markup, session } from 'telegraf'
import type { Message } from 'telegraf/typings/core/types/typegram'
import { prisma } from '../../lib/prisma'                  // ← shared client
import { notifyAdmin } from '../../lib/market-utils'       // ← your helper

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!)

// Session middleware for state management
bot.use(session())

// Enhanced constants
const TRADE_FEE = Number(process.env.TRADE_FEE_PERCENT!) / 100 || 0.01
const LOSER_FEE = Number(process.env.LOSER_FEE_PERCENT!) / 100 || 0.10

// --- Improved Helper Functions ---
function calculatePayout(poolSize: number, shares: number): number {
  return poolSize > 0 ? (shares * poolSize) / (poolSize - shares) : 0
}
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount)
}
function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&')
}

// --- Enhanced Telegram Commands ---
bot.start(async (ctx) => {
  await ctx.replyWithMarkdown(
    `👋 Welcome to *Tovo Prediction Markets*!\n\n` +
    `📊 *Available Commands:*\n` +
    `/markets - List active prediction markets\n` +
    `/balance - Check your account balance\n` +
    `/deposit - Deposit funds instructions\n` +
    `/subscribe - Get new market notifications\n` +
    `/help - Show all commands`,
    Markup.keyboard([['📊 Markets','💰 Balance'],['💸 Deposit','🔔 Subscribe']]).resize()
  )

  // Register new user if doesn't exist
  try {
    await prisma.user.upsert({
      where: { telegramId: ctx.from.id.toString() },
      create: {
        telegramId: ctx.from.id.toString(),
        username: ctx.from.username || '',
        balance: 0
      },
      update: {}
    })
  } catch (err: any) {
    console.error('User registration error:', err)
    await notifyAdmin(`❌ Failed to register user ${ctx.from.id}: ${err.message}`)
  }
})

bot.command('markets', async (ctx) => {
  try {
    const markets = await prisma.market.findMany({
      where: { status: 'open' },
      orderBy: { eventTime: 'asc' },
      take: 5
    })
    if (!markets.length) {
      return ctx.reply('No active markets currently. Check back later!')
    }
    for (const m of markets) {
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ YES', `bet_yes_${m.id}`),
          Markup.button.callback('❌ NO',  `bet_no_${m.id}`)
        ],
        [
          Markup.button.url(
            '📊 Details',
            `${process.env.NEXT_PUBLIC_SITE_URL}/market/${m.id}`
          )
        ]
      ])
      await ctx.replyWithMarkdownV2(
        `*${escapeMarkdown(m.question)}*\n` +
        `⏳ Ends: ${escapeMarkdown(m.eventTime.toUTCString())}\n` +
        `💰 Pool: ${formatCurrency(m.poolYes + m.poolNo)}\n` +
        `🟢 YES: ${formatCurrency(m.poolYes)} | 🔴 NO: ${formatCurrency(m.poolNo)}`,
        keyboard
      )
    }
  } catch (err: any) {
    console.error('Market listing error:', err)
    await ctx.reply('❌ Failed to load markets. Please try again later.')
    await notifyAdmin(`Market listing failed: ${err.message}`)
  }
})

bot.action(/bet_(yes|no)_(.+)/, async (ctx) => {
  const [_, side, marketId] = ctx.match as RegExpMatchArray
  const userId = ctx.from.id.toString()
  try {
    const result = await prisma.$transaction(async (tx) => {
      const market = await tx.market.findUnique({
        where: { id: marketId, status: 'open' }
      })
      if (!market) throw new Error('Market not available')

      const user = await tx.user.findUnique({
        where: { telegramId: userId },
        select: { balance: true }
      })
      if (!user || user.balance < 10) throw new Error('Insufficient balance')

      const fee = 10 * TRADE_FEE
      const net = 10 - fee
      const pool = side === 'yes' ? market.poolYes : market.poolNo
      const shares = calculatePayout(pool, net)

      await tx.market.update({
        where: { id: marketId },
        data: {
          [`pool${side.toUpperCase()}`]: { increment: net },
          feeCollected: { increment: fee }
        }
      })
      await tx.trade.create({
        data: {
          userId,
          marketId,
          type: side,
          amount: 10,
          fee,
          shares,
          payout: 0
        }
      })
      await tx.user.update({
        where: { telegramId: userId },
        data: { balance: { decrement: 10 } }
      })
      return { shares, fee }
    })

    const orig = ctx.callbackQuery.message as Message.TextMessage
    await ctx.editMessageText(
      `${orig.text}\n\n` +
      `✅ @${ctx.from.username} bet $10 on ${side.toUpperCase()}!\n` +
      `• Shares: ${result.shares.toFixed(2)}\n` +
      `• Fee: ${formatCurrency(result.fee)}`,
      Markup.inlineKeyboard([]) // remove buttons
    )
  } catch (err: any) {
    console.error('Bet processing error:', err)
    await ctx.answerCbQuery(err.message || 'Bet failed')
  }
})

bot.command('admin_stats', async (ctx) => {
  if (ctx.from.id.toString() !== process.env.ADMIN_TELEGRAM_ID) return
  const [markets, users, trades] = await Promise.all([
    prisma.market.count(),
    prisma.user.count(),
    prisma.trade.count()
  ])
  await ctx.replyWithMarkdown(
    `*📊 Admin Stats*\n` +
    `• Active markets: ${markets}\n` +
    `• Registered users: ${users}\n` +
    `• Total trades: ${trades}`
  )
})

bot.catch(async (err, ctx) => {
  console.error('Bot error:', err)
  await notifyAdmin(`🚨 Bot crashed: ${err.message}`)
  await ctx.reply('⚠️ An error occurred. Our team has been notified.')
})

export default bot
