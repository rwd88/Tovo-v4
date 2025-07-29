// src/bot/bot.ts
import { Telegraf, session, Markup } from 'telegraf'
import type { Context, Message } from 'telegraf'
import { prisma } from '../lib/prisma'
import { sendAdminAlert } from '../lib/telegram'
import { formatMarketHtml, escapeHtml } from '../lib/market-utils'

// Ensure env vars
if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN missing')
if (!process.env.ADMIN_TELEGRAM_ID) throw new Error('ADMIN_TELEGRAM_ID missing')

const bot = new Telegraf<Context>(process.env.TELEGRAM_BOT_TOKEN)
bot.use(session())

// Fees from env (percent → decimal)
const TRADE_FEE = Number(process.env.TRADE_FEE_PERCENT ?? 1) / 100
const LOSER_FEE = Number(process.env.LOSER_FEE_PERCENT ?? 10) / 100

/** /start */
bot.start(async (ctx) => {
  await ctx.replyWithHTML(
    `<b>👋 Welcome to Tovo Prediction Markets!</b>\n\n` +
    `<b>Available commands:</b>\n` +
    `/markets – List active markets\n` +
    `/balance – Check your balance\n` +
    `/deposit – Deposit instructions\n` +
    `/help – Show this menu`
  )

  // Register user
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
    console.error('User upsert error:', err)
    await sendAdminAlert(`User registration failed: ${err.message}`)
  }
})

/** /markets */
bot.command('markets', async (ctx) => {
  try {
    const markets = await prisma.market.findMany({
      where: { status: 'open' },
      orderBy: { eventTime: 'asc' },
      take: 5
    })
    if (!markets.length) {
      return ctx.reply('No active markets right now.')
    }

    for (const m of markets) {
      const html = formatMarketHtml(m)
      const urlBase = process.env.BOT_WEB_URL!.replace(/\/$/, '')
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ YES', `bet_yes_${m.id}`),
          Markup.button.callback('❌ NO',  `bet_no_${m.id}`)
        ],
        [
          Markup.button.url('📊 Details', `${urlBase}/trade/${m.id}?side=yes`)
        ]
      ])
      await ctx.replyWithHTML(html, keyboard)
    }
  } catch (err: any) {
    console.error('Error in /markets:', err)
    await ctx.reply('❌ Could not load markets.')
    await sendAdminAlert(`Error listing markets: ${err.message}`)
  }
})

/** Handle bet button presses */
bot.action(/bet_(yes|no)_(.+)/, async (ctx) => {
  const [, side, marketId] = (ctx.match as RegExpMatchArray)
  const telegramId = ctx.from.id.toString()

  try {
    const { shares, fee } = await prisma.$transaction(async (tx) => {
      // 1) Get market & user
      const market = await tx.market.findUnique({ where: { id: marketId } })
      if (!market || market.status !== 'open') throw new Error('Market not available')
      const user = await tx.user.findUnique({ where: { telegramId } })
      if (!user || user.balance < 1) throw new Error('Insufficient balance')

      // 2) Deduct fee & update pool
      const stake = 1
      const feeAmt = stake * TRADE_FEE
      const netAmt = stake - feeAmt
      const poolField = side === 'yes' ? 'poolYes' : 'poolNo'

      await tx.market.update({
        where: { id: marketId },
        data: {
          [poolField]:    { increment: netAmt },
          feeCollected:  { increment: feeAmt }
        }
      })

      // 3) Record trade & debit user
      await tx.trade.create({
        data: {
          userId:    user.id,
          marketId,
          type:      side,
          amount:    stake,
          fee:       feeAmt,
          shares:    netAmt,
          payout:    0
        }
      })
      await tx.user.update({
        where: { id: user.id },
        data:  { balance: { decrement: stake } }
      })

      return { shares: netAmt, fee: feeAmt }
    })

    // Acknowledge in chat
    const orig = (ctx.callbackQuery.message as Message.TextMessage).text
    await ctx.editMessageText(
      `${escapeHtml(orig)}\n\n` +
      `✅ You bet $1 on ${side.toUpperCase()}!\n` +
      `• Shares: ${shares.toFixed(2)}\n` +
      `• Fee: $${fee.toFixed(2)}`,
      { parse_mode: 'HTML' }
    )
  } catch (err: any) {
    console.error('Error handling bet:', err)
    await ctx.answerCbQuery(err.message, true)
    await sendAdminAlert(`Bet action failed: ${err.message}`)
  }
})

/** Error catcher */
bot.catch(async (err, ctx) => {
  console.error('Bot error:', err, 'for update', ctx.update)
  await sendAdminAlert(`Bot runtime error: ${err}`)
})

export default bot
