// contexts/SolanaContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { useWallet, WalletProvider } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';

type SolanaContextType = {
  connection: Connection;
  publicKey: PublicKey | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
};

const SolContext = createContext<SolanaContextType>({
  connection: new Connection('https://api.mainnet-beta.solana.com'),
  publicKey: null,
  connect: async () => {},
  disconnect: async () => {},
});

export const SolanaProvider = ({ children }: { children: ReactNode }) => {
  const network = WalletAdapterNetwork.Mainnet;
  const wallets = [new PhantomWalletAdapter()];
  const [connection] = useState(new Connection('https://api.mainnet-beta.solana.com'));
  const { publicKey, wallet, connect, disconnect } = useWallet();

  return (
    <WalletProvider wallets={wallets} autoConnect>
      <WalletModalProvider>
        <SolContext.Provider value={{
          connection,
          publicKey,
          connect: async () => {
            try {
              await connect();
            } catch (error) {
              console.error('Solana connection error:', error);
            }
          },
          disconnect: async () => {
            try {
              await disconnect();
            } catch (error) {
              console.error('Solana disconnection error:', error);
            }
          }
        }}>
          {children}
        </SolContext.Provider>
      </WalletModalProvider>
    </WalletProvider>
  );
};

export const useSolana = () => useContext(SolContext);