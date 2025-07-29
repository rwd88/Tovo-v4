import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { sendTelegramMessage } from '../../../lib/telegram'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: boolean; published: number }>
) {
  // Authentication
  const token = req.query.secret as string || ''
  if (token !== '12345A') {
    return res.status(403).json({ success: false, published: 0 })
  }

  try {
    // 1. Verify the field exists
    const modelFields = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Market' 
      AND column_name = 'last_published_at'
    `;
    
    if (!modelFields.length) {
      throw new Error('lastPublishedAt field missing in database');
    }

    // 2. Get the next market to publish
    const market = await prisma.$transaction(async (tx) => {
      const candidates = await tx.market.findMany({
        where: {
          status: 'open',
          eventTime: { gt: new Date() },
          OR: [
            { lastPublishedAt: null },
            { lastPublishedAt: { lt: new Date(Date.now() - 6 * 60 * 60 * 1000) } }
          ]
        },
        orderBy: [
          { lastPublishedAt: 'asc' },
          { eventTime: 'asc' }
        ],
        take: 1
      });

      if (!candidates.length) return null;

      await tx.market.update({
        where: { id: candidates[0].id },
        data: { lastPublishedAt: new Date() }
      });

      return candidates[0];
    });

    if (!market) {
      return res.status(200).json({ success: true, published: 0 });
    }

    // 3. Format and send message
    const formattedQuestion = market.question.endsWith('?') 
      ? market.question 
      : `${market.question}?`;

    await sendTelegramMessage({
      chat_id: "-1002266469531",
      text: `🎯 *New Prediction Market*\n\n` +
            `*${formattedQuestion}*\n` +
            `🕒 Expires: ${market.eventTime.toUTCString()}\n` +
            `💰 Liquidity: $${(market.poolYes + market.poolNo).toFixed(2)}` +
            (market.forecast ? `\n📈 Forecast: ${market.forecast.toFixed(1)}% YES` : ''),
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: "✅ Trade YES", url: `${process.env.NEXT_PUBLIC_SITE_URL}/trade/${market.id}?side=yes` },
          { text: "❌ Trade NO", url: `${process.env.NEXT_PUBLIC_SITE_URL}/trade/${market.id}?side=no` }
        ]]
      }
    });

    return res.status(200).json({ success: true, published: 1 });

  } catch (err) {
    console.error('Publish failed:', err);
    
    // Special handling for schema errors
    if (err.message.includes('lastPublishedAt') || err.message.includes('Unknown argument')) {
      await sendTelegramMessage({
        chat_id: process.env.ADMIN_TELEGRAM_ID!,
        text: `⚠️ Database Schema Error\n\n${err.message}\n\nRun migrations!`
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      published: 0 
    });
  }
}