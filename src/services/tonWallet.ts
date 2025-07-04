// src/services/tonWallet.ts

export async function initTonProvider() {
  const provider = (window as any).ton;
  if (!provider) {
    throw new Error('TON provider not found in window');
  }
  await provider.ensureInitialized?.();
  return provider;
}
