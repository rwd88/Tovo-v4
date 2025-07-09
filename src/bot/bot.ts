import { Telegraf, Markup } from 'telegraf';
import type { Message } from 'telegraf/typings/core/types/typegram';
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

function isValidSolanaAddress(addr: string): boolean {
  return /^[A-HJ-NP-Za-km-z1-9]{32,44}$/.test(addr);
}

// --- Telegram Commands ---
bot.start((ctx) => {
  ctx.reply(
    `👋 Welcome to *Tovo*, the prediction market bot!\n\n` +
    `Use /listpools to see active markets or /balance to check your funds.`,
    { parse_mode: 'Markdown' }
  );
});

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
      Markup.inlineKeyboard([[
        Markup.button.callback('Bet YES', `bet_yes_${market.id}`),
        Markup.button.callback('Bet NO',  `bet_no_${market.id}`),
      ]])
    );
  }
});

bot.command('balance', async (ctx) => {
  const user = await prisma.user.findUnique({
    where: { telegramId: ctx.from.id.toString() },
  });
  ctx.reply(`💰 Your balance: $${user?.balance.toFixed(2) || '0.00'}`);
});

bot.command('subscribe', async (ctx) => {
  try {
    await prisma.subscriber.upsert({
      where: { chatId: ctx.chat.id.toString() },
      create: {
        chatId: ctx.chat.id.toString(),
        subscribed: true
      },
      update: {
        subscribed: true
      }
    });
    ctx.reply('✅ Successfully subscribed to market updates!');
  } catch (err) {
    console.error('Subscription error:', err);
    ctx.reply('❌ Failed to subscribe. Please try again later.');
  }
});

bot.command('unsubscribe', async (ctx) => {
  try {
    await prisma.subscriber.update({
      where: { chatId: ctx.chat.id.toString() },
      data: { subscribed: false }
    });
    ctx.reply('🔕 You have unsubscribed from market updates.');
  } catch (err) {
    console.error('Unsubscription error:', err);
    ctx.reply('❌ Failed to unsubscribe. Please try again later.');
  }
});


// /link_solana
bot.command('link_solana', async (ctx) => {
  const parts = (ctx.message as any).text.split(' ').slice(1);
  const address = parts[0]?.trim();
  if (!address) return ctx.reply('Usage: /link_solana <Solana address>');
  if (!isValidSolanaAddress(address)) {
    return ctx.reply('❌ That doesn’t look like a valid Solana address.');
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
      },
    });
    return ctx.reply(`✅ Linked your Solana wallet: \`${address}\``);
  } catch (err) {
    console.error('Link Solana error:', err);
    return ctx.reply('❌ Couldn’t link your Solana wallet. Please try again later.');
  }
});

// /link_bsc
bot.command('link_bsc', async (ctx) => {
  const parts = (ctx.message as any).text.split(' ').slice(1);
  const address = parts[0]?.trim();
  if (!address) return ctx.reply('Usage: /link_bsc <BSC (BEP-20) address>');
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return ctx.reply('❌ That doesn’t look like a valid BSC/ETH address.');
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
      },
    });
    return ctx.reply(`✅ Linked your BSC wallet: \`${address}\``);
  } catch (err) {
    console.error('Link BSC error:', err);
    return ctx.reply('❌ Couldn’t link your BSC wallet. Please try again later.');
  }
});

// --- Bet Handling ---
bot.action(/bet_(yes|no)_(.+)/, async (ctx) => {
  // extract match as RegExpExecArray
  const match = ctx.match as RegExpExecArray;
  const side = match[1];       // "yes" or "no"
  const marketId = match[2];

  const userId = ctx.from.id.toString();
  const betAmount = 10;

  // 1. Verify market
  const market = await prisma.market.findUnique({ where: { id: marketId } });
  if (!market || market.status !== 'open') {
    return ctx.answerCbQuery('Market closed or invalid!');
  }

  // 2. Ensure user
  const user = await prisma.user.upsert({
    where: { telegramId: userId },
    create: { id: userId, telegramId: userId, balance: 100 },
    update: {},
  });
  if (user.balance < betAmount) {
    return ctx.answerCbQuery('Insufficient balance!');
  }

  // 3. Fee & shares
  const fee = betAmount * TRADE_FEE;
  const amountAfterFee = betAmount - fee;
  const pool = side === 'yes' ? market.poolYes : market.poolNo;
  const shares = calculateShares(pool, amountAfterFee);

  // 4. DB transaction
  await prisma.$transaction([
    prisma.market.update({
      where: { id: marketId },
      data: {
        [`pool${side.toUpperCase()}`]: { increment: amountAfterFee },
        feeCollected:                  { increment: fee },
      },
    }),
    prisma.trade.create({
      data: {
        userId:  user.telegramId,
        marketId,
        type:    side,
        amount:  betAmount,
        fee,
        shares,
        payout:  0,
      },
    }),
    prisma.user.update({
      where: { telegramId: userId },
      data: { balance: { decrement: betAmount } },
    }),
  ]);

  // 5. Confirm
  const original = ctx.callbackQuery.message as Message.TextMessage | undefined;
  await ctx.editMessageText(
    `${original?.text ?? ''}\n\n` +
    `✅ @${ctx.from.username} bet $${betAmount} on ${side.toUpperCase()}!` +
    ` (Shares: ${shares.toFixed(2)}, Fee: $${fee.toFixed(2)})`
  );
});

// --- Launch & Shutdown ---
bot.launch();
process.once('SIGINT',  () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

export default bot;
