// pages/api/trade/create.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { sendTelegramMessage } from '../../../lib/telegram';

interface TradeRequest {
  userId: string;
  marketId: string;
  amount: number;
  type: 'YES' | 'NO';
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Validate request
    const { userId, marketId, amount, type } = req.body as TradeRequest;

    if (
      !userId ||
      !marketId ||
      typeof amount !== 'number' ||
      amount <= 0 ||
      !['YES', 'NO'].includes(type)
    ) {
      return res.status(400).json({ error: 'Invalid trade parameters' });
    }

    // 2. Verify market availability
    const market = await prisma.market.findUnique({
      where: { id: marketId, status: 'open' },
      select: { question: true, eventTime: true }
    });

    if (!market) {
      return res.status(400).json({ error: 'Market not available for trading' });
    }

    // 3. Check user balance
    const user = await prisma.user.findUnique({
      where: { telegramId: userId },
      select: { balance: true }
    });

    const fee = Number((amount * 0.01).toFixed(2)); // 1% fee
    const totalCost = amount + fee;

    if (!user || user.balance < totalCost) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // 4. Execute trade transaction
    const [trade, updatedUser] = await prisma.$transaction([
      prisma.trade.create({
        data: {
          userId,
          marketId,
          type,
          amount,
          fee,
          settled: false
        }
      }),
      prisma.user.update({
        where: { telegramId: userId },
        data: { balance: { decrement: totalCost } },
        select: { balance: true }
      }),
      prisma.market.update({
        where: { id: marketId },
        data: {
          poolYes: type === 'YES' ? { increment: amount } : undefined,
          poolNo: type === 'NO' ? { increment: amount } : undefined
        }
      })
    ]);

    // 5. Send notification
    await sendTelegramMessage(
      `🎯 New Trade Executed\n` +
      `• User: Anonymous\n` +
      `• Market: ${market.question}\n` +
      `• Direction: ${type} $${amount.toFixed(2)}\n` +
      `• Fee: $${fee.toFixed(2)}`,
      false,
      process.env.TG_CHANNEL_ID!
    );

    return res.status(200).json({
      success: true,
      tradeId: trade.id,
      newBalance: updatedUser.balance,
      marketQuestion: market.question
    });

  } catch (error) {
    console.error('Trade execution failed:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : undefined
    });
  }
}
