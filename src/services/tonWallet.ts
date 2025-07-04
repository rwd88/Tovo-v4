// src/services/tonWallet.ts

import TonProvider from 'ton-inpage-provider';   // default export

// Use a loose `any` type for provider since the class signature isn't known at compile-time
let provider: any = null;

/**
 * Initialize and return the TON in-page provider instance.
 * Ensures a singleton instance is used.
 */
export async function initTonProvider() {
  if (!provider) {
    provider = new TonProvider({ allowHost: true });
    await provider.ensureInitialized();
  }
  return provider;
}
