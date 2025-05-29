// pages/api/trade/trade.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { sendTelegramMessage } from '../../../lib/telegram';

interface TradeRequest {
  userId: string;
  marketId: string;
  amount: number;
  type: 'YES' | 'NO';
}

interface UserWithName {
  balance: number;
  name: string | null;
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
    const { userId, marketId, amount, type } = req.body as TradeRequest;

    // Validate input
    if (!userId || !marketId || !amount || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    if (!['YES', 'NO'].includes(type)) {
      return res.status(400).json({ error: 'Invalid trade type' });
    }

    // Check market exists and is open
    const market = await prisma.market.findUnique({
      where: { id: marketId },
      select: { status: true, question: true }
    });

    if (!market || market.status !== 'open') {
      return res.status(400).json({ error: 'Market not available for trading' });
    }

    // Check user balance with proper typing
    const user = await prisma.user.findUnique({
      where: { telegramId: userId },
      select: { 
        balance: true,
        name: true
      }
    }) as UserWithName | null;

    const fee = Number((amount * 0.01).toFixed(2)); // 1% fee
    const totalCost = amount + fee;

    if (!user || user.balance < totalCost) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Execute trade
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

    // Send notification
    await sendTelegramMessage(
      `🎯 New Prediction\n` +
      `👤 ${user.name || 'Anonymous'}\n` +
      `💰 $${amount.toFixed(2)} on ${type}\n` +
      `❓ ${market.question}\n` +
      `#${marketId.slice(0, 5)}`,
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
    console.error('Trade error:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : undefined
    });
  }
}