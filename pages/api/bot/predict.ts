// pages/api/bot/predict.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { sendTelegramMessage } from '../../../lib/telegram';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId, marketId, prediction, amount } = req.body;

  try {
    // Validate input
    if (!marketId || !prediction || !amount || !userId) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    // Get market details
    const market = await prisma.market.findUnique({
      where: { externalId: marketId },
      select: { question: true, poolYes: true, poolNo: true, status: true }
    });

    if (!market || market.status !== 'open') {
      return res.status(400).json({ error: 'Market not found or closed' });
    }

    // Calculate fees and amounts
    const isEarly = prediction.endsWith('_early');
    const tradeFee = amount * 0.01;
    const earlyCloseFee = isEarly ? amount * 0.10 : 0;
    const totalFee = tradeFee + earlyCloseFee;
    const netAmount = amount - totalFee;

    // Create trade with explicit type
    const tradeData = {
      userId,
      marketId,
      type: prediction.replace('_early', ''),
      amount: netAmount,
      fee: totalFee,
      isEarlyClose: isEarly,
      shares: netAmount // Simplified for example
    };

    await prisma.$transaction([
      prisma.trade.create({ data: tradeData }),
      prisma.market.update({
        where: { externalId: marketId },
        data: {
          poolYes: prediction.startsWith('YES') ? { increment: netAmount } : undefined,
          poolNo: prediction.startsWith('NO') ? { increment: netAmount } : undefined
        }
      })
    ]);

    // Send confirmation
    await sendTelegramMessage(
      `✅ Trade executed!\n` +
      `📌 ${market.question}\n` +
      `🔮 ${prediction} (${isEarly ? 'Early ' : ''}Close)\n` +
      `💰 Net: $${netAmount.toFixed(2)} (Fee: $${totalFee.toFixed(2)})`,
      false,
      userId
    );

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Trade error:', error);
    return res.status(500).json({ error: 'Trade processing failed' });
  }
}