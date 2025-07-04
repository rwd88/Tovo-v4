// src/services/tonWallet.ts

import TonProvider from 'ton-inpage-provider';   // default export

// Remove explicit type annotations; allow TS to infer
let provider = null as any;

// Initialize and return the TON in-page provider instance
export async function initTonProvider() {
  if (!provider) {
    provider = new TonProvider({ allowHost: true });
    await provider.ensureInitialized();
  }
  return provider;
}
