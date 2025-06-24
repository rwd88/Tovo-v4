/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextApiRequest, NextApiResponse } from 'next'
import getRawBody from 'raw-body'
import bot from '../../../src/bot/bot'

// Turn off Next’s JSON parsing so Telegraf can see the raw body
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

    // Let Telegraf process it
    await bot.handleUpdate(update as any, res as any)

    // A simple 200 back to Telegram
    return res.status(200).send('OK')
  } catch (err) {
    console.error('❌ Telegram webhook error', err)
    return res.status(500).send('Error')
  }
}
