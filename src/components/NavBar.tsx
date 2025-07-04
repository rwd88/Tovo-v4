// src/components/NavBar.tsx
import React from 'react';
import { ConnectWalletButton }     from './ConnectWalletButton';
import { SolanaConnectButton }     from './SolanaConnectButton';
import { TonConnectButton }        from './TonConnectButton';

export const NavBar: React.FC = () => (
  <nav className="flex items-center space-x-4 p-4">
    <ConnectWalletButton />
    <SolanaConnectButton />
    <TonConnectButton />
  </nav>
);