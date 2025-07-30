'use client'

import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { InjectedConnector } from 'wagmi/connectors/injected'
import {
  useEffect,
  useState,
  createContext,
  useContext,
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
  const [isMounted, setIsMounted] = useState(false)

  const { connectAsync } = useConnect()
  const { disconnectAsync } = useDisconnect()
  const { address, isConnected } = useAccount()

  useEffect(() => {
    setIsMounted(true)
    return () => setIsMounted(false)
  }, [])

  const connect = async () => {
    if (
      !isMounted ||
      typeof window === 'undefined' ||
      typeof window.ethereum === 'undefined'
    ) {
      alert('MetaMask is not available in this browser.')
      return
    }

    try {
      const connector = new InjectedConnector({
        options: {
          name: 'MetaMask',
          shimDisconnect: true,
        },
      })

      await connectAsync({ connector })
    } catch (error) {
      console.error('Connection error:', error)
      throw error
    }
  }

  const disconnect = async () => {
    if (!isMounted) return
    try {
      await disconnectAsync()
    } catch (error) {
      console.error('Disconnection error:', error)
      throw error
    }
  }

  return (
    <EthereumContext.Provider
      value={{
        address: isMounted ? address : null,
        isConnected: isMounted ? isConnected : false,
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
