// pages/api/telegram-webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import bot from '../../src/bot/bot'
import { verifyTelegramWebhook } from '../../lib/security'

export const config = {
  api: {
    bodyParser: false,
  }
}

async function bufferRequest(req: NextApiRequest): Promise<Buffer> {
  const chunks: Uint8Array[] = []
  return new Promise((resolve, reject) => {
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Verify webhook origin
    if (!verifyTelegramWebhook(req)) {
      return res.status(403).json({ error: 'Invalid webhook origin' })
    }

    const rawBody = await bufferRequest(req)
    const update = JSON.parse(rawBody.toString('utf-8'))
    
    await bot.handleUpdate(update)
    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('Webhook processing error:', err)
    return res.status(500).json({ 
      error: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { details: err.message })
    })
  }
}