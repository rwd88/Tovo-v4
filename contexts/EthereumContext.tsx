// ✅ Update your context export in /contexts/EthereumContext.tsx
'use client'

import {
  useAccount,
  useConnect,
  useDisconnect,
} from 'wagmi'
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
      const injected = connectors.find((c) => c.id === 'injected')
      if (!injected) throw new Error('MetaMask connector not found')
      await connectAsync({ connector: injected })
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
