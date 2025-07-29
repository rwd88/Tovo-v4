'use client'

import {
  useAccount,
  useConnect,
  useDisconnect,
  useConfig,
} from 'wagmi'
import { injected } from '@wagmi/connectors'
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
  isConnected: boolean
}

const EthereumContext = createContext<EthereumContextType>({
  address: null,
  connect: async () => {},
  disconnect: async () => {},
  isConnected: false,
})

export function EthereumProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount()
  const { connectAsync } = useConnect()
  const { disconnectAsync } = useDisconnect()
  const config = useConfig()

  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState(false)

  useEffect(() => {
    if (isConnected && address) {
      setWalletAddress(address)
      setConnectionStatus(true)
    } else {
      setWalletAddress(null)
      setConnectionStatus(false)
    }
  }, [isConnected, address])

  const connect = async () => {
    try {
      await connectAsync({ 
        connector: injected({ target: 'metaMask' }) 
      })
    } catch (err) {
      console.error('Connection error:', err)
      throw err // Re-throw if you want to handle this in the UI
    }
  }

  const disconnect = async () => {
    try {
      await disconnectAsync()
    } catch (err) {
      console.error('Disconnection error:', err)
      throw err
    }
  }

  return (
    <EthereumContext.Provider 
      value={{ 
        address: walletAddress, 
        connect, 
        disconnect,
        isConnected: connectionStatus
      }}
    >
      {children}
    </EthereumContext.Provider>
  )
}

export const useEthereum = () => useContext(EthereumContext)