// pages/api/trade/trade.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { sendTelegramMessage } from '../../../lib/telegram';
import { calculateShares, calculatePotentialPayout } from '../../../lib/cpmm';

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
    const { userId, marketId, amount, type } = req.body as TradeRequest;

    // Input validation
    if (!userId || !marketId || !amount || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    if (!['YES', 'NO'].includes(type)) {
      return res.status(400).json({ error: 'Invalid trade type' });
    }

    // Fetch market data
    const market = await prisma.market.findUnique({
      where: { id: marketId },
      select: { 
        status: true, 
        question: true, 
        poolYes: true, 
        poolNo: true,
        closeDate: true
      }
    });

    if (!market) {
      return res.status(404).json({ error: 'Market not found' });
    }

    if (market.status !== 'open') {
      return res.status(400).json({ error: 'Market not available for trading' });
    }

    // Check user balance
    const user = await prisma.user.findUnique({
      where: { telegramId: userId },
      select: { balance: true, username: true }
    });

    const fee = Number((amount * 0.01).toFixed(2));
    const totalCost = amount + fee;

    if (!user || user.balance < totalCost) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Calculate trade details
    const shares = calculateShares(
      amount,
      market.poolYes,
      market.poolNo,
      type
    );

    const payout = calculatePotentialPayout(
      shares,
      market.poolYes,
      market.poolNo,
      type
    );

    // Execute transaction
    const [trade, updatedUser, updatedMarket] = await prisma.$transaction([
      prisma.trade.create({
        data: {
          userId,
          marketId,
          type,
          amount,
          fee,
          shares,
          payout,
          settled: false,
          createdAt: new Date()
        }
      }),
      prisma.user.update({
        where: { telegramId: userId },
        data: { balance: { decrement: totalCost } },
        select: { balance: true, username: true }
      }),
      prisma.market.update({
        where: { id: marketId },
        data: {
          poolYes: type === 'YES' ? { increment: amount } : undefined,
          poolNo: type === 'NO' ? { increment: amount } : undefined,
          volume: { increment: amount }
        }
      })
    ]);

    // Send notification
    const username = user.username || 'Anonymous';
    await sendTelegramMessage(
      `🎯 New Trade\n` +
      `👤 ${username}\n` +
      `💰 $${amount.toFixed(2)} on ${type}\n` +
      `📊 ${shares.toFixed(4)} shares\n` +
      `🏆 Potential payout: $${payout.toFixed(2)}\n` +
      `❓ ${market.question}\n` +
      `📅 Closes: ${new Date(market.closeDate).toLocaleDateString()}\n` +
      `#${marketId.slice(0, 5)}`
    );

    return res.status(200).json({
      success: true,
      tradeId: trade.id,
      newBalance: updatedUser.balance,
      marketQuestion: market.question,
      shares,
      potentialPayout: payout,
      newPoolYes: updatedMarket.poolYes,
      newPoolNo: updatedMarket.poolNo
    });

  } catch (error) {
    console.error('Trade error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : undefined
    });
  }
}