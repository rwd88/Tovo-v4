// pages/api/bot/predict.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { sendTelegramMessage } from '../../../lib/telegram';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId, marketId, prediction, amount } = req.body;

  try {
    if (!userId || !marketId || !prediction || typeof amount !== 'number') {
      return res.status(400).json({ error: 'Missing or invalid parameters' });
    }

    const market = await prisma.market.findUnique({
      where: { externalId: marketId },
      select: { question: true, poolYes: true, poolNo: true }
    });

    if (!market) return res.status(404).json({ error: 'Market not found' });

    const totalPool = market.poolYes + market.poolNo;
    const yesOdds = totalPool > 0 ? (market.poolNo / totalPool) * 100 : 50;
    const noOdds  = totalPool > 0 ? (market.poolYes / totalPool) * 100 : 50;

    const tradeFee      = amount * 0.01;
    const earlyCloseFee = prediction.endsWith('_early') ? amount * 0.10 : 0;
    const totalFee      = tradeFee + earlyCloseFee;
    const netAmount     = amount - totalFee;
    const baseType      = prediction.replace('_early', '');

    await prisma.$transaction([
      prisma.trade.create({
        data: {
          userId,
          marketId,
          type: baseType,
          amount: netAmount,
          fee: totalFee,
          // ← removed `isEarlyClose` here
        }
      }),
      prisma.market.update({
        where: { externalId: marketId },
        data: {
          poolYes: prediction.startsWith('YES') ? { increment: netAmount } : undefined,
          poolNo:  prediction.startsWith('NO')  ? { increment: netAmount } : undefined,
        }
      })
    ]);

    await sendTelegramMessage(
      `✅ Prediction placed!\n` +
      `📌 ${market.question}\n` +
      `🔮 Your prediction: ${prediction}\n` +
      `💰 Amount: $${amount.toFixed(2)} (Fee: $${totalFee.toFixed(2)})\n` +
      `📊 New odds: YES ${yesOdds.toFixed(1)}% | NO ${noOdds.toFixed(1)}%`,
      false,
      userId
    );

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Prediction error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
