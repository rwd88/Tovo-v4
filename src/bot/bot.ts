// src/bot/bot.ts
import { Telegraf, Markup } from 'telegraf'
import type { Message } from 'telegraf/typings/core/types/typegram'
import axios from 'axios'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!)

// Base URL for your Next.js API (adjust your Vercel domain)
const API_BASE =
  process.env.NODE_ENV === 'production'
    ? 'https://tovo-v4.vercel.app'
    : 'http://localhost:3000'

// Helpers
const TRADE_FEE = 0.01
function calculateShares(poolSize: number, amount: number) {
  return poolSize === 0 ? amount : (amount * poolSize) / (amount + poolSize)
}
function isValidSolanaAddress(addr: string) {
  return /^[A-HJ-NP-Za-km-z1-9]{32,44}$/.test(addr)
}
function isValidEthAddress(addr: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(addr)
}

// ─── Commands ──────────────────────────────────────────────────────

// /start
bot.start((ctx) => {
  ctx.reply(
    `👋 Welcome to *Tovo*, the prediction market bot!\n\n` +
      `Use /listpools to see active markets, /balance to check funds,\n` +
      `/link_solana or /link_bsc to attach your wallet,\n` +
      `and /withdraw <chain> <amount> to pull out funds.`,
    { parse_mode: 'Markdown' }
  )
})

// /listpools
bot.command('listpools', async (ctx) => {
  const markets = await prisma.market.findMany({
    where: { status: 'open' },
    orderBy: { eventTime: 'asc' },
  })
  if (!markets.length) return ctx.reply('No active markets found.')
  for (const m of markets) {
    await ctx.replyWithMarkdown(
      `📊 *${m.question}*\n` +
        `⏰ ${m.eventTime.toUTCString()}\n` +
        `🟢 YES: $${m.poolYes.toFixed(2)} | 🔴 NO: $${m.poolNo.toFixed(2)}`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('Bet YES', `bet_yes_${m.id}`),
          Markup.button.callback('Bet NO', `bet_no_${m.id}`),
        ],
      ])
    )
  }
})

// /balance
bot.command('balance', async (ctx) => {
  const user = await prisma.user.findUnique({
    where: { telegramId: ctx.from.id.toString() },
  })
  const bal = user?.balance.toFixed(2) || '0.00'
  ctx.reply(`💰 Your balance: $${bal}`)
})

// /link_solana
bot.command('link_solana', async (ctx) => {
  const parts = ctx.message.text.split(' ').slice(1)
  const addr = parts[0]?.trim()
  if (!addr) {
    return ctx.reply('Usage: /link_solana <Solana address>')
  }
  if (!isValidSolanaAddress(addr)) {
    return ctx.reply('❌ That doesn’t look like a valid Solana address.')
  }
  await prisma.user.upsert({
    where: { telegramId: ctx.from.id.toString() },
    update: { solanaWallet: addr },
    create: {
      id: ctx.from.id.toString(),
      telegramId: ctx.from.id.toString(),
      balance: 0,
      solanaWallet: addr,
    },
  })
  ctx.reply(`✅ Linked your Solana wallet: \`${addr}\``, {
    parse_mode: 'Markdown',
  })
})

// /link_bsc
bot.command('link_bsc', async (ctx) => {
  const parts = ctx.message.text.split(' ').slice(1)
  const addr = parts[0]?.trim()
  if (!addr) {
    return ctx.reply('Usage: /link_bsc <BSC/ETH address>')
  }
  if (!isValidEthAddress(addr)) {
    return ctx.reply('❌ That doesn’t look like a valid BSC/ETH address.')
  }
  await prisma.user.upsert({
    where: { telegramId: ctx.from.id.toString() },
    update: { bscWallet: addr },
    create: {
      id: ctx.from.id.toString(),
      telegramId: ctx.from.id.toString(),
      balance: 0,
      bscWallet: addr,
    },
  })
  ctx.reply(`✅ Linked your BSC/ETH wallet: \`${addr}\``, {
    parse_mode: 'Markdown',
  })
})

// /withdraw <chain> <amount>
bot.command('withdraw', async (ctx) => {
  const parts = ctx.message.text.trim().split(/\s+/)
  if (parts.length !== 3) {
    return ctx.reply(
      'Usage: /withdraw <chain> <amount>\n' +
        'Chains: solana, bsc, erc20, trc20\n' +
        'Example: /withdraw solana 50'
    )
  }
  const [, chain, amtStr] = parts
  const amount = Number(amtStr)
  if (!['solana', 'bsc', 'erc20', 'trc20'].includes(chain)) {
    return ctx.reply(
      '⚠️ Invalid chain; must be one of solana, bsc, erc20, trc20.'
    )
  }
  if (!amount || amount <= 0) {
    return ctx.reply('⚠️ Amount must be a positive number.')
  }

  try {
    const res = await axios.post(
      `${API_BASE}/api/withdraw/create`,
      { userId: ctx.from.id.toString(), chain, amount },
      {
        headers: {
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const { nonce, typedData, expiresAt } = res.data as any
    await ctx.reply(
      `✅ Withdrawal created!\n\n` +
        `Nonce: \`${nonce}\`\n` +
        `Expires: ${new Date(expiresAt).toUTCString()}\n\n` +
        `🔗 Sign this typed data:\n` +
        '```json\n' +
        JSON.stringify(typedData, null, 2) +
        '\n```',
      { parse_mode: 'Markdown' }
    )
  } catch (e: any) {
    console.error('Withdraw error:', e.response?.data || e.message)
    const errMsg =
      e.response?.data?.error ||
      e.response?.data ||
      e.message ||
      'Unknown error'
    ctx.reply(`❌ Failed: ${errMsg}`)
  }
})

// --- Bet handlers (unchanged) ---
bot.action(/bet_(yes|no)_(.+)/, async (ctx) => {
  const [, side, marketId] = ctx.match!
  const userId = ctx.from.id.toString()
  const betAmount = 10

  const market = await prisma.market.findUnique({ where: { id: marketId } })
  if (!market || market.status !== 'open') {
    return ctx.answerCbQuery('Market closed or invalid!')
  }

  const user = await prisma.user.upsert({
    where: { telegramId: userId },
    create: {
      id: userId,
      telegramId: userId,
      balance: 100,
    },
    update: {},
  })

  if (user.balance < betAmount) {
    return ctx.answerCbQuery('Insufficient balance!')
  }

  const fee = betAmount * TRADE_FEE
  const amtAfterFee = betAmount - fee
  const pool = side === 'yes' ? market.poolYes : market.poolNo
  const shares = calculateShares(pool, amtAfterFee)

  await prisma.$transaction([
    prisma.market.update({
      where: { id: marketId },
      data: {
        [`pool${side.toUpperCase()}`]: { increment: amtAfterFee },
        feeCollected: { increment: fee },
      },
    }),
    prisma.trade.create({
      data: {
        userId: user.telegramId,
        marketId,
        type: side,
        amount: betAmount,
        fee,
        shares,
        payout: 0,
      },
    }),
    prisma.user.update({
      where: { telegramId: userId },
      data: { balance: { decrement: betAmount } },
    }),
  ])

  const origMsg = ctx.callbackQuery.message as Message.TextMessage | undefined
  await ctx.editMessageText(
    `${origMsg?.text}\n\n` +
      `✅ @${ctx.from.username} bet $${betAmount} on ${side.toUpperCase()}! ` +
      `(Shares: ${shares.toFixed(2)}, Fee: $${fee.toFixed(2)})`
  )
})

// ───────────────────────────────────────────────────────────────────
bot.launch()
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

export default bot
