// lib/__mocks__/cpmm.ts
import { jest } from '@jest/globals';

// we only mock out the calculateShares export
export const calculateShares = jest.fn();
