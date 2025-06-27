// lib/solana.tsx
import React, {
  createContext,
  useContext,
  useState,
  PropsWithChildren,
} from 'react'
import { Connection, PublicKey } from '@solana/web3.js'

interface SolanaContextType {
  connection: Connection
  walletPubkey: PublicKey | null
  setWalletPubkey: (pubkey: PublicKey | null) => void
}

const SolanaContext = createContext<SolanaContextType | undefined>(undefined)

export function SolanaWalletProvider({
  children,
}: PropsWithChildren<{}>) {
  const [walletPubkey, setWalletPubkey] = useState<PublicKey | null>(null)
  // swap to your RPC endpoint
  const connection = new Connection('https://api.mainnet-beta.solana.com')

  return (
    <SolanaContext.Provider
      value={{ connection, walletPubkey, setWalletPubkey }}
    >
      {children}
    </SolanaContext.Provider>
  )
}

export function useSolana(): SolanaContextType {
  const ctx = useContext(SolanaContext)
  if (!ctx) {
    throw new Error(
      'useSolana must be used inside <SolanaWalletProvider>'
    )
  }
  return ctx
}
