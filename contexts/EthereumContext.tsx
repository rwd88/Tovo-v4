'use client'

import {
  useAccount,
  useConnect,
  useDisconnect,
  useConfig,
} from 'wagmi'

import { InjectedConnector } from '@wagmi/connectors/injected'
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react'

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
  const config = useConfig()
  const { connectAsync } = useConnect()
  const { disconnectAsync } = useDisconnect()
  const { address, isConnected } = useAccount()

  const [walletAddress, setWalletAddress] = useState<string | null>(null)

  useEffect(() => {
    if (isConnected && address) {
      setWalletAddress(address)
    }
  }, [isConnected, address])

  const connect = async () => {
    try {
      await connectAsync({ connector: new InjectedConnector({ config }) })
    } catch (err) {
      console.error('Connect error:', err)
    }
  }

  const disconnect = async () => {
    try {
      await disconnectAsync()
      setWalletAddress(null)
    } catch (err) {
      console.error('Disconnect error:', err)
    }
  }

  return (
    <EthereumContext.Provider value={{ address: walletAddress, connect, disconnect }}>
      {children}
    </EthereumContext.Provider>
  )
}

export const useEthereum = () => useContext(EthereumContext)
