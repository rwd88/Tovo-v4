import { getCpmmProbability, calculateShares } from '../lib/cpmm';

describe('getCpmmProbability', () => {
  test('returns 0.5 for empty pool', () => {
    expect(getCpmmProbability(0, 0)).toEqual({ probYes: 0.5, probNo: 0.5 });
  });

  test('calculates correct probabilities', () => {
    expect(getCpmmProbability(30, 70)).toEqual({ probYes: 0.3, probNo: 0.7 });
  });
});

describe('calculateShares', () => {
  test('calculates shares for YES bet', () => {
    const shares = calculateShares(50, 100, 100, 'YES');
    expect(shares).toBeCloseTo(33.333, 3);
  });
test('calculates shares for NO bet', () => {
    const shares = calculateShares(50, 100, 100, 'NO');
    expect(shares).toBeCloseTo(33.333, 3);
  });

  test('handles zero pools', () => {
    const shares = calculateShares(10, 0, 0, 'YES');
    expect(shares).toBe(0);
  });
});