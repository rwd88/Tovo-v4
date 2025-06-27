// lib/wallet.ts
/* eslint-disable @typescript-eslint/no-explicit-any */


/**
 * Validate that a string is a Base58 Solana address (32–44 chars).
 */
export function isValidSolanaAddress(addr: string): boolean {
  return /^[A-HJ-NP-Za-km-z1-9]{32,44}$/.test(addr);
}

/**
 * Validate that a string is an Ethereum/BSC (0x…) address.
 */
export function isValidEthAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

/**
 * Validate that a string is a Tron (TRC-20) address.
 */
export function isValidTronAddress(addr: string): boolean {
  return /^T[a-zA-Z0-9]{33}$/.test(addr);
}
