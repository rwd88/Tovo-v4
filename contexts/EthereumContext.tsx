// contexts/EthereumContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react'
import Web3Modal from 'web3modal'
import { Web3Provider } from '@ethersproject/providers'

interface EthContextType {
  provider: Web3Provider | null
  address: string | null
  connect: () => Promise<void>
  disconnect: () => void
}

const EthContext = createContext<EthContextType>({
  provider: null,
  address: null,
  connect: async () => {},
  disconnect: () => {}
})

export const EthereumProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [provider, setProvider] = useState<Web3Provider | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const web3Modal = new Web3Modal({ cacheProvider: true })

  const connect = async () => {
    const instance = await web3Modal.connect()
    const web3Provider = new Web3Provider(instance)
    setProvider(web3Provider)

    try {
      const signer = web3Provider.getSigner()
      const addr = await signer.getAddress()
      setAddress(addr)
    } catch (err) {
      console.error('Failed to get signer address', err)
    }
  }

  const disconnect = () => {
    web3Modal.clearCachedProvider()
    setProvider(null)
    setAddress(null)
  }

  // Auto-reconnect if previously connected
  useEffect(() => {
    if (web3Modal.cachedProvider) {
      connect().catch(console.error)
    }
  }, [])

  return (
    <EthContext.Provider value={{ provider, address, connect, disconnect }}>
      {children}
    </EthContext.Provider>
  )
}

// Hook for easy consumption
export const useEthereum = () => useContext(EthContext)
