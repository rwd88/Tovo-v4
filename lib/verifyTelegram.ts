// lib/verifyTelegram.ts
import crypto from 'crypto';

export function verifyTelegramWebAppData(token: string, initData: string): boolean {
  const urlSearchParams = new URLSearchParams(initData);
  const hash = urlSearchParams.get('hash');
  urlSearchParams.delete('hash');

  // Backward-compatible iteration
  const entries: [string, string][] = [];
  urlSearchParams.forEach((val, key) => entries.push([key, val]));

  const dataCheckString = entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => `${key}=${val}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  return calculatedHash === hash;
}

// Alternative simplified version if you don't need sorting:
export function quickVerifyTelegramData(token: string, initData: string): boolean {
  const urlSearchParams = new URLSearchParams(initData);
  const hash = urlSearchParams.get('hash');
  
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(initData.replace(/&hash=[^&]*/, '').replace(/hash=[^&]*&?/, ''))
    .digest('hex');

  return calculatedHash === hash;
}