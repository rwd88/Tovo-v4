import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { calculateShares } from '../../../../lib/cpmm';

interface PredictRequest {
  userId: string;
  marketId: string;
  amount: number;
  prediction: 'yes' | 'no';
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
    const { userId, marketId, amount, prediction } = req.body as PredictRequest;

    // Validate input
    if (!userId || !marketId || !amount || !prediction) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Get market details - using id instead of externalId
    const market = await prisma.market.findUnique({
      where: { id: marketId },  // Changed from externalId to id
      select: { 
        question: true, 
        poolYes: true, 
        poolNo: true, 
        status: true,
        externalId: true 
      }
    });

    if (!market || market.status !== 'open') {
      return res.status(400).json({ error: 'Market not available for trading' });
    }

    // Calculate trade details
    const shares = calculateShares(
      amount,
      market.poolYes,
      market.poolNo,
      prediction
    );

    const fee = amount * 0.01;
    const payout = shares * (prediction === 'yes' 
      ? market.poolYes / market.poolNo 
      : market.poolNo / market.poolYes
    );

    // Execute transaction
    const [trade, updatedUser] = await prisma.$transaction([
      prisma.trade.create({
        data: {
          userId,
          marketId,
          type: prediction,
          amount,
          fee,
          payout,
          shares,
          settled: false
        }
      }),
      prisma.user.update({
        where: { telegramId: userId },
        data: { balance: { decrement: amount + fee } }
      })
    ]);

    return res.status(200).json({
      success: true,
      tradeId: trade.id,
      shares,
      payout,
      newBalance: updatedUser.balance
    });

  } catch (error) {
    console.error('Prediction error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : undefined
    });
  }
}