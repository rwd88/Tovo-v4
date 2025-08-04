// middleware.ts
import type { NextFetchEvent, NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export function middleware(req: NextRequest, ev: NextFetchEvent) {
  const res = NextResponse.next()
  res.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; connect-src 'self' https://metamask.app.link; img-src 'self' data:; script-src 'self';"
  )
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('X-XSS-Protection', '1; mode=block')
  return res
}
export const config = { matcher: ['/api/:path*'] }
