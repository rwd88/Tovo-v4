import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { sendAdminAlert, sendTelegramMessage } from '../../../lib/telegram'
import { formatMarketMessage } from '../../../lib/market-utils'

interface PublishResult {
  id: string
  question: string
  telegramSent: boolean
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ 
    success: boolean
    results: PublishResult[]
    stats?: {
      total: number
      success: number
      failed: number
    }
  }>
) {
  // Authentication
  const token = req.query.secret || req.headers.authorization?.split(' ')[1] || ''
  if (token !== process.env.CRON_SECRET) {
    await sendAdminAlert('⚠️ Unauthorized access attempt to publish-markets')
    return res.status(403).json({ 
      success: false, 
      results: [] 
    })
  }

  try {
    console.log('[PUBLISH] Starting market publication...')
    
    // 1. Get unpublished markets
    const markets = await prisma.market.findMany({
      where: { 
        status: 'open',
        notified: false,
        eventTime: { gt: new Date() }
      },
      orderBy: { eventTime: 'asc' },
      take: 50 // Limit to prevent timeout
    })

    if (markets.length === 0) {
      console.log('[PUBLISH] No markets to publish')
      return res.status(200).json({ 
        success: true, 
        results: [],
        stats: { total: 0, success: 0, failed: 0 }
      })
    }

    const results: PublishResult[] = []
    let successCount = 0
    let failCount = 0

    // 2. Process markets in batches
    for (const market of markets) {
      const result: PublishResult = {
        id: market.id,
        question: market.question,
        telegramSent: false
      }

      try {
        // Enhanced message formatting
        const message = `🎯 *New Trading Opportunity!*\n\n` +
          `${formatMarketMessage(market)}\n\n` +
          `_Expires: ${market.eventTime?.toUTCString()}_`

        console.log(`[PUBLISH] Sending market ${market.id} to Telegram`)
        
        await sendTelegramMessage({
          chat_id: process.env.TELEGRAM_CHANNEL_ID!,
          text: message,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { 
                  text: '📈 Trade YES', 
                  url: `${process.env.BOT_WEB_URL}/trade/${market.id}?side=yes` 
                },
                { 
                  text: '📉 Trade NO', 
                  url: `${process.env.BOT_WEB_URL}/trade/${market.id}?side=no` 
                }
              ],
              [
                {
                  text: '📊 View Market',
                  url: `${process.env.BOT_WEB_URL}/markets/${market.id}`
                }
              ]
            ]
          }
        })

        await prisma.market.update({
          where: { id: market.id },
          data: { notified: true }
        })

        result.telegramSent = true
        successCount++
        console.log(`[SUCCESS] Published market ${market.id}`)

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        console.error(`[FAILED] Market ${market.id}:`, errorMsg)
        result.error = errorMsg
        failCount++
        
        // Send immediate alert for critical failures
        if (errorMsg.includes('blocked') || errorMsg.includes('403')) {
          await sendAdminAlert(`🚨 Critical Telegram error: ${errorMsg}`)
        }
      }

      results.push(result)
    }

    // 3. Send summary notification
    const summary = `📢 Published ${successCount} markets\n` +
      `${failCount > 0 ? `⚠️ Failed: ${failCount}` : '✅ All succeeded'}`
    
    await sendAdminAlert(summary)

    return res.status(200).json({ 
      success: true, 
      results,
      stats: {
        total: markets.length,
        success: successCount,
        failed: failCount
      }
    })

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[CRITICAL] Publish failed:', errorMsg)
    
    await sendAdminAlert(`💥 publish-markets crashed:\n${errorMsg}`)
    
    return res.status(500).json({ 
      success: false, 
      results: [],
      stats: { total: 0, success: 0, failed: 0 }
    })
  }
}