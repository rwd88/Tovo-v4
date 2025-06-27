import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
} from 'react'
import { Connection, PublicKey } from '@solana/web3.js'

interface SolanaContextType {
  connection: Connection
  walletPubkey: PublicKey | null
  setWalletPubkey: (pubkey: PublicKey | null) => void
}

const SolanaContext = createContext<SolanaContextType | undefined>(undefined)

export function SolanaWalletProvider(props: { children: ReactNode }) {
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

export function useSolana() {
  const ctx = useContext(SolanaContext)
  if (!ctx) throw new Error('useSolana must be used inside SolanaWalletProvider')
  return ctx
}
