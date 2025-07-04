// src/services/tonWallet.ts

import TonProvider from 'ton-inpage-provider';   // if default export
let provider: TonProvider | null = null;

export async function initTonProvider(): Promise<TonProvider> {
  if (!provider) {
    provider = new TonProvider({ allowHost: true });
    await provider.ensureInitialized();
  }
  return provider;
}