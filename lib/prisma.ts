// lib/prisma.ts
import  PrismaClient  from '@prisma/client'

declare global {
  var prisma: PrismaClient | undefined
}

const prismaOptions = {
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error'] 
    : ['warn', 'error']
}

export const prisma = global.prisma || new PrismaClient(prismaOptions)

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
}

// Optional: Add Prisma middleware
prisma.$use(async (params, next) => {
  const before = Date.now()
  const result = await next(params)
  const after = Date.now()
  
  console.log(`Query ${params.model}.${params.action} took ${after - before}ms`)
  return result
})

export default prisma