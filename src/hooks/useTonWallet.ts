// src/hooks/useTonWallet.ts
import { useState, useEffect } from 'react';
import { initTonProvider } from '../services/tonWallet';

export function useTonWallet() {
  const [account, setAccount] = useState<string | null>(null);

  useEffect(() => {
    initTonProvider().then((provider) => {
      // Listen for account changes
      provider.on('accountsChanged', (accounts: string[]) => {
        setAccount(accounts.length > 0 ? accounts[0] : null);
      });

      // Request initial accounts list
      provider.request({ method: 'ton_requestAccounts' })
        .then((accounts: string[]) => setAccount(accounts[0] || null))
        .catch(() => setAccount(null));
    });
  }, []);

  return { account };
}