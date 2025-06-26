// pages/api/telegram-webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import getRawBody from 'raw-body'
import bot from '../../src/bot/bot'    // adjust relative path to your bot.ts

export const config = {
  api: {
    bodyParser: false,  // IMPORTANT: we need the raw body
  },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).send('Only POST allowed')
  }

  try {
    const raw = await getRawBody(req)
    const update = JSON.parse(raw.toString('utf-8'))
    await bot.handleUpdate(update, res)
    res.status(200).send('OK')
  } catch (err) {
    console.error('Webhook error', err)
    res.status(500).send('Error')
  }
}
