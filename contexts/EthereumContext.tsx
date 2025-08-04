'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import WalletConnectProvider from '@walletconnect/web3-provider'
import { ethers } from 'ethers'

interface EthereumContextType {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  address: string | null
  provider: ethers.BrowserProvider | null
}

const EthereumContext = createContext<EthereumContextType>({
  connect: async () => {},
  disconnect: async () => {},
  address: null,
  provider: null,
})

export function EthereumProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null)

  const connect = async () => {
    if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
      // ✅ Use MetaMask directly on desktop or mobile with extension
      const web3 = new ethers.BrowserProvider(window.ethereum)
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      const userAddress = accounts[0]

      setProvider(web3)
      setAddress(userAddress)

      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        setAddress(accounts[0] || null)
      })

      return
    }

    // ❌ Fallback to WalletConnect (iOS / no extension)
    const wcProvider = new WalletConnectProvider({
      rpc: {
        1: 'https://mainnet.infura.io/v3/YOUR_INFURA_ID',
        11155111: 'https://sepolia.infura.io/v3/YOUR_INFURA_ID',
      },
      chainId: 11155111,
    })

    await wcProvider.enable()
    const web3 = new ethers.BrowserProvider(wcProvider)
    const signer = await web3.getSigner()
    const userAddress = await signer.getAddress()

    setProvider(web3)
    setAddress(userAddress)

    wcProvider.on('disconnect', () => {
      setProvider(null)
      setAddress(null)
    })
  }

  const disconnect = async () => {
    if ((provider?.provider as any)?.disconnect) {
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
