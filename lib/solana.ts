// lib/solana.ts
import {
  WalletAdapterNetwork
} from "@solana/wallet-adapter-base";
import {
  ConnectionProvider, WalletProvider
} from "@solana/wallet-adapter-react";
import {
  PhantomWalletAdapter, SolflareWalletAdapter
} from "@solana/wallet-adapter-wallets";

export const SolanaWalletProvider: React.FC = ({ children }) => {
  const network = WalletAdapterNetwork.Mainnet;
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC!;
  const wallets = [ new PhantomWalletAdapter(), new SolflareWalletAdapter() ];
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
};
