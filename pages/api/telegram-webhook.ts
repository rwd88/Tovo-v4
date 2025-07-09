// pages/api/telegram-webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import getRawBody from 'raw-body'
import { bot } from '../../src/bot/bot'

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
    res.setHeader('Allow', 'POST')
    return res.status(405).send('Only POST allowed')
  }

  const secretToken = req.headers['x-telegram-bot-api-secret-token']
  if (secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return res.status(403).send('Invalid secret token')
  }

  try {
    const raw = await getRawBody(req)
    await bot.handleUpdate(JSON.parse(raw.toString()))
    res.status(200).send('OK')
  } catch (err) {
    console.error('Telegram webhook error', err)
    if (!res.writableEnded) {
      res.status(500).send('Error')
    }
  }
}