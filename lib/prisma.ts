/* eslint-disable */
// File: lib/prisma.ts

import { PrismaClient } from '@prisma/client'

declare global {
  // prevent multiple clients in dev
  // @ts-expect-error
  var __prisma: PrismaClient | undefined
}

export const prisma =
  global.__prisma ||
  new PrismaClient({ log: ['query'] })

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma
}
