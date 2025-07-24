// pages/api/cron/publish-markets.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import bot from '../../../src/bot/bot'
import { formatMarketMessage } from '../../../lib/market-utils'

interface PublishResult {
  id: string
  question: string
  sentCount: number
  failedCount: number
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    | { success: true; results: PublishResult[]; failedSends?: { chatId: string; error: string }[] }
    | { success: false; error: string }
  >
) {
  // Enhanced authentication
  const authMethods = [
    req.query.secret as string,
    req.headers.authorization?.split(' ')[1],
    req.headers['x-cron-secret']
  ].filter(Boolean)

  if (!authMethods.includes(process.env.CRON_SECRET!)) {
    return res.status(403).json({ success: false, error: 'Unauthorized' })
  }

  try {
    const [openMarkets, subscribers] = await Promise.all([
      prisma.market.findMany({
        where: { 
          status: 'open', 
          notified: false,
          question: { not: '' }
        },
        orderBy: { eventTime: 'asc' },
        take: 10 // Limit to prevent timeout
      }),
      prisma.subscriber.findMany({ 
        where: { subscribed: true },
        select: { chatId: true }
      })
    ])

    const results: PublishResult[] = []
    const failedSends: Array<{ chatId: string; error: string }> = []

    // Parallel processing with rate limiting
    await Promise.all(openMarkets.map(async (market) => {
      try {
        const { id, question } = market
        const message = formatMarketMessage(market)
        
        const sendPromises = subscribers.map(sub => 
          sendWithRetry(sub.chatId, message, createButtons(id), 2)
            .catch(err => {
              const errorMsg = err.description || err.message || String(err)
              failedSends.push({ chatId: sub.chatId, error: errorMsg })
              
              if (err.code === 403) {
                return prisma.subscriber.update({
                  where: { chatId: sub.chatId },
                  data: { subscribed: false }
                })
              }
              return Promise.resolve()
            })
        )

        const settled = await Promise.allSettled(sendPromises)
        const sentCount = settled.filter(p => p.status === 'fulfilled').length

        await prisma.market.update({
          where: { id },
          data: { notified: true }
        })

        results.push({ 
          id, 
          question, 
          sentCount, 
          failedCount: subscribers.length - sentCount 
        })
      } catch (err) {
        console.error(`Failed processing market ${market.id}:`, err)
      }
    }))

    return res.status(200).json({ 
      success: true, 
      results,
      ...(failedSends.length && { failedSends })
    })
  } catch (err: any) {
    console.error('Cron job failed:', err)
    return res.status(500).json({ 
      success: false, 
      error: err.message 
    })
  }
}

function createButtons(marketId: string) {
  return {
    parse_mode: 'Markdown' as const,
    reply_markup: {
      inline_keyboard: [[
        { 
          text: '✅ YES', 
          url: `${process.env.NEXT_PUBLIC_SITE_URL}/trade/${marketId}?side=yes` 
        },
        { 
          text: '❌ NO',  
          url: `${process.env.NEXT_PUBLIC_SITE_URL}/trade/${marketId}?side=no`  
        }
      ]]
    }
  }
}

async function sendWithRetry(
  chatId: string,
  message: string,
  buttons: any,
  retries: number
): Promise<void> {
  try {
    await bot.telegram.sendMessage(chatId, message, buttons)
  } catch (err: any) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 1000 * (3 - retries))) // Exponential backoff
      return sendWithRetry(chatId, message, buttons, retries - 1)
    }
    throw err
  }
}