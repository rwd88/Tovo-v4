/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable no-var */

import { PrismaClient } from '@prisma/client'

declare global {
  // prevent multiple clients in dev
  // @ts-ignore
  // @ts-expect-error
  var __prisma: PrismaClient | undefined
}

export const prisma =
  global.__prisma ||
  new PrismaClient({ log: ['query'] })

if (process.env.NODE_ENV !== 'production') {
  // @ts-ignore
  global.__prisma = prisma
}
