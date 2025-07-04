// src/services/tonWallet.ts

// No longer using TonProvider namespace—import default if available
import hasTonProvider from 'ton-inpage-provider';

// Loose provider instance, let TS infer
let provider: any = null;

/**
 * Initialize and return the TON in-page provider if available.
 * Uses hasTonProvider() to verify existence.
 */
export async function initTonProvider() {
  if (!provider) {
    if (!hasTonProvider()) {
      throw new Error('TON provider not found in window');
    }
    provider = window.ton;
  }
  return provider;
}
