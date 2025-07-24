// lib/security.ts
import { NextApiRequest } from 'next'

export function verifyTelegramWebhook(req: NextApiRequest): boolean {
  // Verify Telegram webhook origin
  if (process.env.NODE_ENV === 'development') return true
  
  const secretToken = req.headers['x-telegram-bot-api-secret-token']
  return secretToken === process.env.TELEGRAM_WEBHOOK_SECRET
}

export function validateCronRequest(req: NextApiRequest): boolean {
  const validSecrets = [
    req.query.secret,
    req.headers.authorization?.split(' ')[1],
    req.headers['x-cron-secret']
  ]
  return validSecrets.includes(process.env.CRON_SECRET!)
}