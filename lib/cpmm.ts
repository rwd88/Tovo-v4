// lib/cpmm.ts

export function getCpmmProbability(poolYes: number, poolNo: number): { probYes: number, probNo: number } {
  const total = poolYes + poolNo;
  if (total === 0) return { probYes: 0.5, probNo: 0.5 }; // default odds

  return {
    probYes: poolYes / total,
    probNo: poolNo / total
  };
}

export function calculateShares(amount: number, poolYes: number, poolNo: number, betOn: 'YES' | 'NO') {
  const k = poolYes * poolNo;

  if (betOn === 'YES') {
    const newPoolYes = poolYes + amount;
    const newPoolNo = k / newPoolYes;
    const shares = poolNo - newPoolNo;
    return shares;
  } else {
    const newPoolNo = poolNo + amount;
    const newPoolYes = k / newPoolNo;
    const shares = poolYes - newPoolYes;
    return shares;
  }
}
