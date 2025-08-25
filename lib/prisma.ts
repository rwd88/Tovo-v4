// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

/** Block Edge runtime (Prisma needs Node.js) */
if (typeof (globalThis as any).EdgeRuntime !== 'undefined') {
  throw new Error('Prisma is not supported in the Edge runtime. Use runtime: "nodejs".')
}

/** Reuse a single client in dev */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
const isDev = process.env.NODE_ENV !== 'production'

const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isDev ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
  })

/** Attach middleware only if the client actually has `$use` */
const hasUse = typeof (prisma as any)?.$use === 'function'
const MW_KEY = Symbol.for('prisma.middleware.attached')

if (hasUse && !(globalThis as any)[MW_KEY]) {
  ;(globalThis as any)[MW_KEY] = true
  ;(prisma as any).$use(async (params: any, next: any) => {
    const start = isDev ? Date.now() : 0
    try {
      const result = await next(params)
      if (isDev) {
        const ms = Date.now() - start
        console.log(`🔍 prisma: ${params.model}.${params.action} took ${ms}ms`)
      }
      return result
    } catch (err: any) {
      const msg = String(err?.message || '').toLowerCase()
      if (
        err?.code === 'P1001' || // timeout
        err?.code === 'P1002' || // connection issue
        msg.includes('closed') ||
        msg.includes('connection reset') ||
        msg.includes('server closed')
      ) {
        if (isDev) {
          console.warn(
            `⚠️ prisma transient error on ${params.model}.${params.action} — retrying once…`,
            err?.code || err?.message
          )
        }
        await new Promise((r) => setTimeout(r, 120))
        return next(params)
      }
      throw err
    }
  })
} else if (!hasUse) {
  // Last‑ditch safety: don't throw — just warn and keep exporting the client
  if (isDev) console.warn('⚠️ prisma.$use is not a function; exporting client without middleware.')
}

if (isDev) globalForPrisma.prisma = prisma

process.on('beforeExit', async () => {
  try { await prisma.$disconnect() } catch {}
})

export default prisma
