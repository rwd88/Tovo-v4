/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { createContext, useContext, useState, useEffect } from 'react'
import { Connection, PublicKey } from '@solana/web3.js'



// 1. Define the shape of your Solana context
interface SolanaContextValue {
  connection: Connection
  walletPubkey: PublicKey | null
  connect(): Promise<void>
}

// 2. Create it
const SolanaContext = createContext<SolanaContextValue | null>(null)

// 3. Provider component
export const SolanaWalletProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const [walletPubkey, setWalletPubkey] = useState<PublicKey | null>(null)

  // You can swap in your cluster / RPC endpoint here
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed')

  // Example connect function (phantom)
  const connect = async () => {
    try {
      // @ts-ignore window.solana
      const resp = await window.solana.connect()
      setWalletPubkey(new PublicKey(resp.publicKey.toString()))
    } catch (err) {
      console.error('Solana connect error', err)
    }
  }

  // If you want auto-reconnect on mount:
  useEffect(() => {
    // @ts-ignore
    if (window.solana?.isPhantom) {
      // Optionally, call window.solana.connect({ onlyIfTrusted: true })
    }
  }, [])

  return (
    <SolanaContext.Provider value={{ connection, walletPubkey, connect }}>
      {children}
    </SolanaContext.Provider>
  )
}

// 4. Hook for consuming
export const useSolana = () => {
  const ctx = useContext(SolanaContext)
  if (!ctx) throw new Error('useSolana must be used within SolanaWalletProvider')
  return ctx
}
