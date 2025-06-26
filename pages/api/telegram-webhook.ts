// pages/api/telegram-webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import getRawBody from 'raw-body'
import bot from '../../src/bot/bot'

// Turn off Next’s automatic body parsing
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

  try {
    const raw = await getRawBody(req)
    // Pass the raw update to Telegraf
    await bot.handleUpdate(JSON.parse(raw.toString()))
    // end the HTTP call
    res.status(200).send('OK')
  } catch (err) {
    console.error('Telegram webhook error', err)
    // if we already called res.send(), skip this
    if (!res.writableEnded) {
      res.status(500).send('Error')
    }
  }
}
