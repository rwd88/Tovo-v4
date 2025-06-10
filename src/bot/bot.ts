// src/bot/bot.ts
import { Telegraf, Markup } from 'telegraf';
import { PrismaClient } from '@prisma/client';

// Initialize Prisma and Telegraf
const prisma = new PrismaClient();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

// Constants
const TRADE_FEE = 0.01;  // 1% fee on trades

// --- Helper Functions ---
function calculateShares(poolSize: number, amount: number): number {
  return poolSize === 0 ? amount : (amount * poolSize) / (amount + poolSize);
}

// --- Telegram Commands ---

// /start - Welcome message
bot.start((ctx) => {
  ctx.reply(
    `👋 Welcome to *Tovo*, the prediction market bot!\n\n` +
    `Use /listpools to see active markets or /balance to check your funds.`,
    { parse_mode: 'Markdown' }
  );
});

// /listpools - Show active markets with Yes/No buttons
bot.command('listpools', async (ctx) => {
  const markets = await prisma.market.findMany({
    where: { status: 'open' },
    orderBy: { eventTime: 'asc' },
  });

  if (markets.length === 0) {
    return ctx.reply('No active markets found. Check back later!');
  }

  for (const market of markets) {
    await ctx.replyWithMarkdown(
      `📊 *${market.question}*\n` +
      `⏰ ${market.eventTime.toUTCString()}\n` +
      `🟢 YES: $${market.poolYes.toFixed(2)} | 🔴 NO: $${market.poolNo.toFixed(2)}`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('Bet YES', `bet_yes_${market.id}`),
          Markup.button.callback('Bet NO', `bet_no_${market.id}`),
        ],
      ])
    );
  }
});

// /balance - Show user's balance
bot.command('balance', async (ctx) => {
  const user = await prisma.user.findUnique({
    where: { telegramId: ctx.from.id.toString() },
  });

  ctx.reply(`💰 Your balance: $${user?.balance.toFixed(2) || '0.00'}`);
});

// --- Bet Handling ---
bot.action(/bet_(yes|no)_(.+)/, async (ctx) => {
  const [, side, marketId] = ctx.match;
  const userId = ctx.from.id.toString();
  const betAmount = 10; // Default bet (replace with user input)

  // 1. Check if market exists
  const market = await prisma.market.findUnique({ where: { id: marketId } });
  if (!market || market.status !== 'open') {
    return ctx.answerCbQuery('Market closed or invalid!');
  }

  // 2. Check or create user
  const user = await prisma.user.upsert({
    where: { telegramId: userId },
    create: {
      id: userId,
      telegramId: userId,
      balance: 100, // Default balance
    },
    update: {},
  });

  if (user.balance < betAmount) {
    return ctx.answerCbQuery('Insufficient balance!');
  }

  // 3. Calculate fees and shares
  const fee = betAmount * TRADE_FEE;
  const amountAfterFee = betAmount - fee;
  const pool = side === 'yes' ? market.poolYes : market.poolNo;
  const shares = calculateShares(pool, amountAfterFee);

  // 4. Update database
  await prisma.$transaction([
    prisma.market.update({
      where: { id: marketId },
      data: {
        [`pool${side.toUpperCase()}`]: { increment: amountAfterFee },
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
        payout: 0,      // ← required field
      },
    }),
    prisma.user.update({
      where: { telegramId: userId },
      data: { balance: { decrement: betAmount } },
    }),
  ]);

  // 5. Confirm bet
  await ctx.editMessageText(
    `${ctx.callbackQuery.message?.text}\n\n` +
    `✅ @${ctx.from.username} bet $${betAmount} on ${side.toUpperCase()}!` +
    ` (Shares: ${shares.toFixed(2)}, Fee: $${fee.toFixed(2)})`
  );
});

// --- Start Bot ---
bot.launch();

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
