// pages/_app.tsx
'use client';

import '../styles/globals.css';
import type { AppProps } from 'next/app';

import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { TonProvider } from '../contexts/TonContext';
import { SolanaProvider } from '../contexts/SolanaContext';
import { EthereumProvider } from '../contexts/EthereumContext';

import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';

import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import '@solana/wallet-adapter-react-ui/styles.css';

const solanaEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL!;
const tonManifestUrl = process.env.NEXT_PUBLIC_TON_MANIFEST_URL!;

const solanaWallets = [
  new PhantomWalletAdapter(),
  new SolflareWalletAdapter(),
];

export default function App({ Component, pageProps }: AppProps) {
  return (
    <TonConnectUIProvider manifestUrl={tonManifestUrl}>
      <EthereumProvider>
        <ConnectionProvider endpoint={solanaEndpoint}>
          <WalletProvider wallets={solanaWallets} autoConnect>
            <SolanaProvider>
              <TonProvider>
                <Component {...pageProps} />
              </TonProvider>
            </SolanaProvider>
          </WalletProvider>
        </ConnectionProvider>
      </EthereumProvider>
    </TonConnectUIProvider>
  );
}
