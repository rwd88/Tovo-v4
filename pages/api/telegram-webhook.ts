// pages/api/telegram-webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import getRawBody from 'raw-body'
import bot from '../../../src/bot/bot'

// Disable Next’s default body parsing, so Telegraf can consume the raw JSON
export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).send('Method Not Allowed')
  }

  try {
    // Grab the raw request body
    const raw = await getRawBody(req)
    const update = JSON.parse(raw.toString('utf-8'))

    // Let Telegraf process the update
    await bot.handleUpdate(update, res as any)

    // Telegram just needs a 200
    return res.status(200).send('OK')
  } catch (err) {
    console.error('⚠️ Telegram webhook error', err)
    return res.status(500).send('Error')
  }
}
