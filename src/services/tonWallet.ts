// src/services/tonWallet.ts

// Use the injected TON in-page provider from the browser window
export async function initTonProvider() {
  const provider = (window as any).ton;
  if (!provider) {
    throw new Error('TON provider not found in window');
  }
  // Optionally ensure it's initialized if that method exists
  if (typeof provider.ensureInitialized === 'function') {
    await provider.ensureInitialized();
  }
  return provider;
}
