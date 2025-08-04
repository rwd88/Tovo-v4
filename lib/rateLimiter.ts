import { RateLimiterMemory } from 'rate-limiter-flexible'

export const rateLimiter = new RateLimiterMemory({
  points: 5,      // max 5 requests...
  duration: 1,    // ...per second per IP
})
