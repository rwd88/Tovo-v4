// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'

declare global {
  // avoid re-instantiating in dev
  var prisma: PrismaClient | undefined
}

const prismaOptions = {
  log:
    process.env.NODE_ENV === 'development'
      ? ['query', 'info', 'warn', 'error']
      : ['warn', 'error'],
}

export const prisma =
  global.prisma ||
  new PrismaClient(prismaOptions)

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
}

// Optional: log every query’s duration
prisma.$use(async (params, next) => {
  const before = Date.now()
  const result = await next(params)
  const after = Date.now()
  console.log(`🔍 prisma: ${params.model}.${params.action} took ${after - before}ms`)
  return result
})

export default prisma
