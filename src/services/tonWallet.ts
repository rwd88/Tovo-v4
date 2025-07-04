// src/services/tonWallet.ts

import TonProvider from 'ton-inpage-provider';

let provider = null as any;

export async function initTonProvider() {
  if (!provider) {
    provider = new TonProvider({ allowHost: true });
    await provider.ensureInitialized();
  }
  return provider;
}