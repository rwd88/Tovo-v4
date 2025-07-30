'use client'

import { useAccount, useConnect, useDisconnect } from 'wagmi'
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react'

interface EthereumContextType {
  address: string | null
  isConnected: boolean
  connect: () => Promise<void>
  disconnect: () => Promise<void>
}

const EthereumContext = createContext<EthereumContextType>({
  address: null,
  isConnected: false,
  connect: async () => {},
  disconnect: async () => {},
})

export function EthereumProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setMounted(true)
    }
  }, [])

  // ✅ Only use wagmi hooks *after* mounted
  const { address, isConnected } = mounted ? useAccount() : { address: null, isConnected: false }
  const { connectAsync, connectors } = mounted ? useConnect() : { connectAsync: async () => {}, connectors: [] }
  const { disconnectAsync } = mounted ? useDisconnect() : { disconnectAsync: async () => {} }

  const connect = async () => {
    if (!mounted) return
    try {
      const injectedConnector = connectors.find((c) => c.id === 'injected')
      if (!injectedConnector) throw new Error('MetaMask connector not found')
      await connectAsync({ connector: injectedConnector })
    } catch (error) {
      console.error('Connection error:', error)
    }
  }

  const disconnect = async () => {
    if (!mounted) return
    try {
      await disconnectAsync()
    } catch (error) {
      console.error('Disconnection error:', error)
    }
  }

  return (
    <EthereumContext.Provider
      value={{
        address,
        isConnected,
        connect,
        disconnect,
      }}
    >
      {children}
    </EthereumContext.Provider>
  )
}
