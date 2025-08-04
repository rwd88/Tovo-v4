'use client'

import { createContext, useContext, useState } from 'react'
import WalletConnectProvider from '@walletconnect/web3-provider'
import { BrowserProvider } from 'ethers'

interface EthereumContextType {
  connect: (wallet?: 'metamask' | 'trust') => Promise<void>
  disconnect: () => Promise<void>
  address: string | null
  provider: BrowserProvider | null
}

const EthereumContext = createContext<EthereumContextType>({
  connect: async () => {},
  disconnect: async () => {},
  address: null,
  provider: null,
})

export function EthereumProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [provider, setProvider] = useState<BrowserProvider | null>(null)

  const connect = async (wallet: 'metamask' | 'trust' = 'metamask') => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

    const wcProvider = new WalletConnectProvider({
      rpc: {
        1: 'https://mainnet.infura.io/v3/YOUR_INFURA_ID',
        11155111: 'https://sepolia.infura.io/v3/YOUR_INFURA_ID',
      },
      chainId: 11155111,
      qrcodeModalOptions: {
        mobileLinks: ['metamask', 'trust'],
      },
    })

    if (isMobile) {
      const dappUrl = 'tovo-v4.vercel.app' // without https
      let link = ''

      if (wallet === 'metamask') {
        link = `https://metamask.app.link/dapp/${dappUrl}`
      } else {
        link = `https://link.trustwallet.com/open_url?coin_id=60&url=https://${dappUrl}`
      }

      window.location.href = link
      return
    }

    await wcProvider.enable()
    const web3 = new BrowserProvider(wcProvider as any)
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
