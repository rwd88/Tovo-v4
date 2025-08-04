'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import WalletConnectProvider from '@walletconnect/web3-provider'
import { ethers } from 'ethers'

interface EthereumContextType {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  address: string | null
  provider: ethers.providers.Web3Provider | null
}

const EthereumContext = createContext<EthereumContextType>({
  connect: async () => {},
  disconnect: async () => {},
  address: null,
  provider: null,
})

export function EthereumProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null)

  const connect = async () => {
    const wcProvider = new WalletConnectProvider({
      rpc: {
        1: 'https://mainnet.infura.io/v3/YOUR_INFURA_ID',
        11155111: 'https://sepolia.infura.io/v3/YOUR_INFURA_ID',
      },
      chainId: 11155111,
    })

    await wcProvider.enable()
    const web3 = new ethers.providers.Web3Provider(wcProvider)
    const signer = web3.getSigner()
    const userAddress = await signer.getAddress()

    setProvider(web3)
    setAddress(userAddress)

    wcProvider.on('disconnect', () => {
      setProvider(null)
      setAddress(null)
    })
  }

  const disconnect = async () => {
    if (provider?.provider?.disconnect) {
      await (provider.provider as any).disconnect()
    }
    setProvider(null)
    setAddress(null)
  }

  return (
    <EthereumContext.Provider value={{ connect, disconnect, address, provider }}>
      {children}
    </EthereumContext.Provider>
  )
}

export function useEthereum() {
  return useContext(EthereumContext)
}
