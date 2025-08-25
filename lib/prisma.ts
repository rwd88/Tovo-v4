// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

/**
 * Prisma must NOT be used in the Edge runtime.
 * Ensure any route using this runs on Node.js runtime.
 */
if (typeof (globalThis as any).EdgeRuntime !== 'undefined') {
  throw new Error('Prisma is not supported in the Edge runtime. Use runtime: "nodejs".')
}

// Keep one instance during hot-reload in dev
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
const isDev = process.env.NODE_ENV !== 'production'

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isDev ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
  })


const MW_KEY = Symbol.for('prisma.timingMw.attached')
const g: any = globalThis
if (!g[MW_KEY]) {
  g[MW_KEY] = true

  prisma.$use(async (params, next) => {
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
}

// expose single instance in dev
if (isDev) globalForPrisma.prisma = prisma

// optional: graceful disconnect (handy for local scripts)
process.on('beforeExit', async () => {
  try {
    await prisma.$disconnect()
  } catch {
    /* ignore */
  }
})

/** ESM + CJS + named compatibility */
export { prisma }                           // supports: import { prisma } from '.../lib/prisma'
export default prisma                       // supports: import prisma from '.../lib/prisma'
// Support require()/transpile edge cases
// @ts-ignore
if (typeof module !== 'undefined' && module.exports) {
  ;(module as any).exports = prisma
  ;(module as any).exports.default = prisma
}
