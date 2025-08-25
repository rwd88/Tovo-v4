// pages/api/nonce.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../lib/prisma'
import { v4 as uuid } from 'uuid'
import { rateLimiter } from '../../lib/rateLimiter'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // rate-limit
  try {
    await rateLimiter.consume(req.socket.remoteAddress!)
  } catch {
    return res.status(429).json({ error: 'Too many requests' })
  }

  const address = (req.query.address as string || '').toLowerCase()
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return res.status(400).json({ error: 'Invalid address' })
  }

  const nonce = uuid()
  await prisma.walletNonce.upsert({
    where: { address },
    update: { nonce, updatedAt: new Date() },
    create: { address, nonce },
  })

  res.status(200).json({ nonce })
}
