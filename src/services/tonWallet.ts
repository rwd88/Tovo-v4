// src/services/tonWallet.ts

import { TonProvider } from 'ton-inpage-provider';

let provider: TonProvider | null = null;

/**
 * Initialize and return the TON in-page provider instance.
 * Ensures only one instance is created and re-used.
 */
export async function initTonProvider(): Promise<TonProvider> {
  if (!provider) {
    provider = new TonProvider({ allowHost: true });
    await provider.ensureInitialized();
  }
  return provider;
}
