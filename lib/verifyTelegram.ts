// lib/verifyTelegram.ts
import crypto from 'crypto';

export function isValidTelegramInitData(initData: string, botToken: string): boolean {
  const urlSearchParams = new URLSearchParams(initData);
  const hash = urlSearchParams.get('hash');
  if (!hash) return false;

  urlSearchParams.delete('hash');

  const dataCheckString = [...urlSearchParams.entries()]
    .map(([key, val]) => `${key}=${val}`)
    .sort()
    .join('\n');

  const secretKey = crypto.createHash('sha256')
    .update(botToken)
    .digest();

  const hmac = crypto.createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  return hmac === hash;
}
