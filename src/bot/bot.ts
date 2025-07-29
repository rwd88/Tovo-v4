// pages/api/telegram-webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { buffer } from 'micro'
import bot from '../../src/bot/bot'
import { verifyTelegramWebhook } from '../../lib/security'
import { sendAdminAlert } from '../../lib/telegram'

export const config = {
  api: {
    bodyParser: false,
  },
}

async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Uint8Array[] = []
  return new Promise((resolve, reject) => {
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    // Optional: verify origin signature
    if (!verifyTelegramWebhook(req)) {
      return res.status(403).json({ error: 'Invalid webhook origin' })
    }

    const raw = await getRawBody(req)
    const update = JSON.parse(raw.toString('utf-8'))
    await bot.handleUpdate(update)

    res.status(200).json({ success: true })
  } catch (err: any) {
    console.error('Webhook processing error:', err)
    await sendAdminAlert(`Webhook crashed: ${err.message}`)
    res.status(500).json({ error: 'Internal Server Error' })
  }
}
