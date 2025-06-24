// pages/api/telegram-webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import getRawBody from 'raw-body'
import bot from '../../src/bot/bot'   // <- make sure the path is correct

export const config = {
  api: {
    bodyParser: false,  // we need the raw body for telegraf
  },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).send('Only POST allowed')
  const raw = await getRawBody(req)
  try {
    await bot.handleUpdate(JSON.parse(raw.toString()))
    return res.status(200).send('OK')
  } catch (err) {
    console.error(err)
    return res.status(500).send('Error')
  }
}
