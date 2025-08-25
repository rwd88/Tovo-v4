// pages/api/trade/Create.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma'
import { sendTelegramMessage } from '../../../lib/telegram';

type TradeType = 'YES' | 'NO';

interface TradeRequest {
  userId?: string;    // primary field
  id?: string;        // backwards‐compat alias
  marketId: string;   // always a string
  amount: number;
  type: TradeType;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // only POST allowed
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1️⃣ extract
  const { userId: uid, id: altId, marketId, amount, type } =
    req.body as TradeRequest;
  const userId = uid ?? altId;

  // 2️⃣ validate
  if (
    !userId ||
    !marketId ||
    typeof amount !== 'number' ||
    amount <= 0 ||
    (type !== 'YES' && type !== 'NO')
  ) {
    return res.status(400).json({ error: 'Invalid trade parameters' });
  }

  try {
    // 3️⃣ ensure user record exists
    await prisma.user.upsert({
      where: { telegramId: userId },
      update: {},
      create: {
        id: userId,
        telegramId: userId,
        balance: 0,
      },
    });

    // 4️⃣ load & lock the market
    const market = await prisma.market.findFirst({
      where: { id: marketId, status: 'open' },
      select: { question: true },
    });
    if (!market) {
      return res
        .status(400)
        .json({ error: 'Market not available for trading' });
    }

    // 5️⃣ check user balance
    const user = await prisma.user.findUnique({
      where: { telegramId: userId },
      select: { balance: true },
    });
    const fee = Number((amount * 0.01).toFixed(2));
    const totalCost = amount + fee;
    if (!user || user.balance < totalCost) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // 6️⃣ transaction: record trade, debit user, bump pool
    const [trade, updatedUser] = await prisma.$transaction([
      prisma.trade.create({
        data: {
          userId,
          marketId,
          type,
          amount,
          fee,
          payout: 0,
          shares: amount,
          settled: false,
        },
      }),
      prisma.user.update({
        where: { telegramId: userId },
        data: { balance: { decrement: totalCost } },
        select: { balance: true },
      }),
      prisma.market.update({
        where: { id: marketId },
        data: {
          poolYes: type === 'YES' ? { increment: amount } : undefined,
          poolNo: type === 'NO' ? { increment: amount } : undefined,
        },
      }),
    ]);

    // 7️⃣ notify Telegram channel
    await sendTelegramMessage(
      `🎯 New Trade Executed\n` +
        `• User: ${userId}\n` +
        `• Market: ${market.question}\n` +
        `• Direction: ${type} $${amount.toFixed(2)}\n` +
        `• Fee: $${fee.toFixed(2)}`,
      false,
      process.env.TG_CHANNEL_ID!
    );

    // 8️⃣ success response
    return res.status(200).json({
      success: true,
      tradeId: trade.id,
      newBalance: updatedUser.balance,
      marketQuestion: market.question,
    });
  } catch (error) {
    console.error('[/api/trade/Create] error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : undefined,
    });
  }
}
