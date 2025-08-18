// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'

declare global {
  // avoid re-instantiating in dev
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

const isDev = process.env.NODE_ENV === 'development'

const prismaOptions = {
  log: isDev ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
}

const _prisma = global.prisma ?? new PrismaClient(prismaOptions)

/**
 * Identify transient/connection errors that are safe to retry once.
 */
function isTransientPrismaError(err: any): boolean {
  if (!err) return false

  // Prisma known request/initialization error codes
  const code = err.code as string | undefined
  if (code === 'P1001' /* timeout */ || code === 'P1002' /* connection issue */) return true

  // Message fragments commonly seen with Neon/pgbouncer/serverless idle closes
  const msg = String(err.message || '').toLowerCase()
  return (
    msg.includes('closed') || // "Error { kind: Closed, cause: None }"
    msg.includes('connection closed') ||
    msg.includes('server closed the connection unexpectedly') ||
    msg.includes('terminating connection due to administrator command') ||
    msg.includes('econnreset') ||
    msg.includes('the server closed the connection')
  )
}

/**
 * Global middleware: timing + one-shot retry on transient errors.
 */
_prisma.$use(async (params, next) => {
  const start = isDev ? Date.now() : 0

  try {
    const result = await next(params)
    if (isDev) {
      const ms = Date.now() - start
      console.log(`🔍 prisma: ${params.model}.${params.action} took ${ms}ms`)
    }
    return result
  } catch (err: any) {
    // Retry once on transient errors
    if (isTransientPrismaError(err)) {
      if (isDev) {
        console.warn(
          `⚠️ prisma transient error on ${params.model}.${params.action} — retrying once…`,
          err?.code || err?.message || err
        )
      }
      // brief backoff
      await new Promise((r) => setTimeout(r, 120))
      return next(params)
    }
    throw err
  }
})

if (process.env.NODE_ENV !== 'production') {
  global.prisma = _prisma
}

// Graceful shutdown in server or local scripts
process.on('beforeExit', async () => {
  try {
    await _prisma.$disconnect()
  } catch {
    /* ignore */
  }
})

export const prisma = _prisma
export default prisma
