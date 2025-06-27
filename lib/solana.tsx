// lib/solana.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, {
  createContext,
  useContext,
  useState,
  PropsWithChildren,
} from 'react'
import { Connection, PublicKey } from '@solana/web3.js'

// 1) Context shape
interface SolanaContextType {
  connection: Connection
  walletPubkey: PublicKey | null
  setWalletPubkey: (pubkey: PublicKey | null) => void
}

// 2) Create context
const SolanaContext = createContext<SolanaContextType | undefined>(undefined)

// 3) Provider – note: **named** export
export function SolanaWalletProvider(
  props: PropsWithChildren<{}>
) {
  const { children } = props
  const [walletPubkey, setWalletPubkey] = useState<PublicKey | null>(null)
  const connection = new Connection('https://api.mainnet-beta.solana.com')

  return (
    <SolanaContext.Provider
      value={{ connection, walletPubkey, setWalletPubkey }}
    >
      {children}
    </SolanaContext.Provider>
  )
}

// 4) Consumer hook
export function useSolana(): SolanaContextType {
  const ctx = useContext(SolanaContext)
  if (!ctx) {
    throw new Error('useSolana must be used inside <SolanaWalletProvider>')
  }
  return ctx
}
