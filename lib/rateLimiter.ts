// lib/rateLimiter.ts
type Bucket = { lastRefill: number; tokens: number }

const buckets = new Map<string, Bucket>()
const MAX_TOKENS = 5
const REFILL_INTERVAL = 1000 // ms

export async function rateLimiter(ip: string) {
  const now = Date.now()
  let bucket = buckets.get(ip)
  if (!bucket) {
    bucket = { lastRefill: now, tokens: MAX_TOKENS }
    buckets.set(ip, bucket)
  }
  // Refill tokens
  const elapsed = now - bucket.lastRefill
  const refillCount = Math.floor(elapsed / REFILL_INTERVAL)
  if (refillCount > 0) {
    bucket.tokens = Math.min(MAX_TOKENS, bucket.tokens + refillCount)
    bucket.lastRefill = now
  }
  if (bucket.tokens > 0) {
    bucket.tokens--
    return
  }
  throw new Error('RATE_LIMIT_EXCEEDED')
}
