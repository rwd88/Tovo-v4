// src/components/TonConnectButton.tsx
import React from 'react';
import { useTonWallet } from '../hooks/useTonWallet';

export const TonConnectButton: React.FC = () => {
  const { account } = useTonWallet();
  return (
    <button
      onClick={() => window.ton.request({ method: 'ton_requestAccounts' })}
      className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
    >
      {account ? `TON: ${account.slice(0,6)}...` : 'Connect TON'}
    </button>
  );
};