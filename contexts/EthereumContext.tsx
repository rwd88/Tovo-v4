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
  const { address, isConnected } = useAccount()
  const { connectAsync, connectors } = useConnect()
  const { disconnectAsync } = useDisconnect()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setMounted(true)
    }
  }, [])

  const connect = async () => {
    try {
      const injectedConnector = connectors.find((c) => c.id === 'injected')
      if (!injectedConnector) throw new Error('MetaMask connector not found')

      await connectAsync({ connector: injectedConnector })
    } catch (error) {
      console.error('Connection error:', error)
    }
  }

  const disconnect = async () => {
    try {
      await disconnectAsync()
    } catch (error) {
      console.error('Disconnection error:', error)
    }
  }

  return (
    <EthereumContext.Provider
      value={{
        address: mounted ? address ?? null : null,
        isConnected: mounted ? isConnected : false,
        connect,
        disconnect,
      }}
    >
      {children}
    </EthereumContext.Provider>
  )
}

export const useEthereum = () => {
  const context = useContext(EthereumContext)
  if (!context) {
    throw new Error('useEthereum must be used within an EthereumProvider')
  }
  return context
}
