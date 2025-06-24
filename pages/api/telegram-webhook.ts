/* pages/api/telegram-webhook.ts */
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { NextApiRequest, NextApiResponse } from 'next'
import getRawBody from 'raw-body'
import bot from '../../src/bot/bot'

export const config = {
  api: {
    bodyParser: false,  // disable Next’s JSON parsing
  },
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).end('Method Not Allowed')
  }

  try {
    const buf = await getRawBody(req)
    const update = JSON.parse(buf.toString())
    await bot.handleUpdate(update)
    return res.status(200).send('OK')
  } catch (err) {
    console.error('🛑 Webhook error', err)
    return res.status(500).send('Error')
  }
}
