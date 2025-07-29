'use client'

import {
  useAccount,
  useConnect,
  useDisconnect,
  useConfig,
} from 'wagmi'
import { InjectedConnector } from '@wagmi/connectors/injected' // ✅ Correct import
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface EthereumContextType {
  address: string | null
  connect: () => Promise<void>
  disconnect: () => Promise<void>
}

const EthereumContext = createContext<EthereumContextType>({
  address: null,
  connect: async () => {},
  disconnect: async () => {},
})

export function EthereumProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)

  const config = useConfig()
  const { connectAsync } = useConnect({
    connector: new InjectedConnector(),
    config,
  })
  const { disconnectAsync } = useDisconnect()
  const { isConnected, address: wagmiAddress } = useAccount()

  useEffect(() => {
    if (isConnected && wagmiAddress) {
      setAddress(wagmiAddress)
    } else {
      setAddress(null)
    }
  }, [isConnected, wagmiAddress])

  const connect = async () => {
    try {
      const result = await connectAsync()
      if (result.accounts.length > 0) {
        setAddress(result.accounts[0].address)
      }
    } catch (err) {
      console.error('❌ Failed to connect MetaMask:', err)
    }
  }

  const disconnect = async () => {
    try {
      await disconnectAsync()
      setAddress(null)
    } catch (err) {
      console.error('❌ Failed to disconnect wallet:', err)
    }
  }

  return (
    <EthereumContext.Provider value={{ address, connect, disconnect }}>
      {children}
    </EthereumContext.Provider>
  )
}

export const useEthereum = () => useContext(EthereumContext)
