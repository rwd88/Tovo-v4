// pages/_app.tsx
'use client'

import '../styles/globals.css'
import type { AppProps } from 'next/app'

// TonConnect
import {
  TonConnectUIProvider,
  AdapterInpage,           // 👈 only the in-page adapter
} from '@tonconnect/ui-react'

// your other providers…
import { EthereumProvider } from '../contexts/EthereumContext'
import { SolanaProvider }  from '../contexts/SolanaContext'
import {
  ConnectionProvider as SolanaConnectionProvider,
  WalletProvider     as SolanaWalletProvider,
} from '@solana/wallet-adapter-react'
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets'
import '@solana/wallet-adapter-react-ui/styles.css'

export default function App({ Component, pageProps }: AppProps) {
  const tonManifestUrl = process.env.NEXT_PUBLIC_TON_MANIFEST_URL!
  const solanaEndpoint  = process.env.NEXT_PUBLIC_SOLANA_RPC_URL!

  const solanaWallets = [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ]

  return (
    // Only the in-page adapter, so no Binance deep-link
    <TonConnectUIProvider
      manifestUrl={tonManifestUrl}
      adapters={[ new AdapterInpage() ]}
    >
      <EthereumProvider>
        <SolanaConnectionProvider endpoint={solanaEndpoint}>
          <SolanaWalletProvider wallets={solanaWallets} autoConnect>
            <SolanaProvider>
              <Component {...pageProps} />
            </SolanaProvider>
          </SolanaWalletProvider>
        </SolanaConnectionProvider>
      </EthereumProvider>
    </TonConnectUIProvider>
  )
}
