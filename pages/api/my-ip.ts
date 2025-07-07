// pages/api/my-ip.ts
import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // x-forwarded-for may contain a comma-separated list; take the first one
  const forwarded = req.headers['x-forwarded-for']
  const ip = typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : // fallback to socket address (127.0.0.1 or ::1 on localhost)
      req.socket.remoteAddress || 'unknown'

  res.status(200).json({ ip })
}
