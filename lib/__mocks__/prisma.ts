// lib/__mocks__/prisma.ts
import { jest } from '@jest/globals';

export const prisma = {
  user: {
    upsert:     jest.fn(),
    findUnique: jest.fn(),
    update:     jest.fn(),
  },
  market: {
    findFirst:  jest.fn(),
    findUnique: jest.fn(),
    update:     jest.fn(),
    upsert:     jest.fn(),    // ← add this
  },
  trade: {
    create:     jest.fn(),
  },
  $transaction: jest.fn(),
};
