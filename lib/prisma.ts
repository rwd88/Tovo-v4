/* eslint-disable @typescript-eslint/ban-ts-comment */
import { PrismaClient } from '@prisma/client'

declare global {
  // prevent multiple clients in dev
  // @ts-expect-error
  let __prisma: PrismaClient | undefined
}

export const prisma =
  global.__prisma ||
  new PrismaClient({ log: ['query'] })

if (process.env.NODE_ENV !== 'production') {
  // @ts-expect-error
  global.__prisma = prisma
}
