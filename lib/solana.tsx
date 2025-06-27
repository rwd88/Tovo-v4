import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  PropsWithChildren,
  ReactElement
} from 'react';
import { Connection, PublicKey } from '@solana/web3.js';

/**
 * 1) Define the shape of our context
 */
interface SolanaContextType {
  connection: Connection;
  walletPubkey: PublicKey | null;
  setWalletPubkey: (pubkey: PublicKey | null) => void;
}

/**
 * 2) Create the context with an undefined default
 */
const SolanaContext = createContext<SolanaContextType | undefined>(undefined);

/**
 * 3) Provider component
 */
export const SolanaWalletProvider: React.FC<PropsWithChildren<{}>> = ({ 
  children 
}): ReactElement => {
  const [walletPubkey, setWalletPubkey] = useState<PublicKey | null>(null);
  const connection = new Connection('https://api.mainnet-beta.solana.com');

  return (
    <SolanaContext.Provider value={{ connection, walletPubkey, setWalletPubkey }}>
      {children}
    </SolanaContext.Provider>
  );
};

/**
 * 4) Hook to consume the context
 */
export function useSolana(): SolanaContextType {
  const ctx = useContext(SolanaContext);
  if (!ctx) {
    throw new Error('useSolana must be used within <SolanaWalletProvider>');
  }
  return ctx;
}