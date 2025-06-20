// contexts/EthereumContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react'
import { ethers } from 'ethers'
import Web3Modal from 'web3modal'

type EthContextType = {
  provider: ethers.providers.Web3Provider | null
  address: string | null
  connect: () => Promise<void>
  disconnect: () => void
}

const EthContext = createContext<EthContextType>({
  provider: null,
  address: null,
  connect: async () => {},
  disconnect: () => {},
})

export const EthereumProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const web3Modal = new Web3Modal({ cacheProvider: true })

  const connect = async () => {
    const instance = await web3Modal.connect()
    const web3provider = new ethers.providers.Web3Provider(instance)
    setProvider(web3provider)

    const signer = web3provider.getSigner()
    const addr = await signer.getAddress()
    setAddress(addr)
  }

  const disconnect = () => {
    web3Modal.clearCachedProvider()
    setProvider(null)
    setAddress(null)
  }

  useEffect(() => {
    if (web3Modal.cachedProvider) {
      connect()
    }
  }, [])

  return (
    <EthContext.Provider value={{ provider, address, connect, disconnect }}>
      {children}
    </EthContext.Provider>
  )
}

export const useEthereum = () => useContext(EthContext)
