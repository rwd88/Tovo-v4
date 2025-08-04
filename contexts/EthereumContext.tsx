'use client'

import {
  useAccount,
  useConnect,
  useDisconnect,
} from 'wagmi'
import {
  InjectedConnector,
  MetaMaskConnector,
  WalletConnectConnector,
} from '@wagmi/connectors'

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

const EthereumContext = createContext<EthereumContextType | undefined>(undefined)

export function EthereumProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount()
  const { connectAsync, connectors } = useConnect()
  const { disconnectAsync } = useDisconnect()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const connect = async () => {
    try {
      const connector =
        connectors.find((c) => c.id === 'metaMask') ||
        connectors.find((c) => c.id === 'walletConnect') ||
        connectors.find((c) => c.id === 'injected')

      if (!connector) throw new Error('No supported wallet found.')

      await connectAsync({ connector })
    } catch (err) {
      console.error('Connect error:', err)
    }
  }

  const disconnect = async () => {
    try {
      await disconnectAsync()
    } catch (err) {
      console.error('Disconnect error:', err)
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

export function useEthereum(): EthereumContextType {
  const ctx = useContext(EthereumContext)
  if (!ctx) throw new Error('useEthereum must be used within EthereumProvider')
  return ctx
}
