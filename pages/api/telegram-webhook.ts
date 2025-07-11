// pages/api/telegram-webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import bot from '../../src/bot/bot'

// Turn off Next’s automatic body parsing
export const config = {
  api: {
    bodyParser: false,
  },
}

async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Uint8Array[] = []
  return new Promise((resolve, reject) => {
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
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
    return res.status(405).send('Only POST allowed')
  }

  try {
    const rawBuf = await getRawBody(req)
    await bot.handleUpdate(JSON.parse(rawBuf.toString('utf-8')))
    return res.status(200).send('OK')
  } catch (err) {
    console.error('Telegram webhook error', err)
    if (!res.writableEnded) res.status(500).send('Error')
  }
}
