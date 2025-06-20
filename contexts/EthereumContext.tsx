// contexts/EthereumContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
} from 'react'
import { Web3Provider as EthersWeb3Provider } from '@ethersproject/providers'

type EthContextType = {
  provider: EthersWeb3Provider | null
  address: string | null
  connect: () => Promise<void>
  disconnect: () => Promise<void>
}

const EthContext = createContext<EthContextType>({
  provider: null,
  address: null,
  connect: async () => {},
  disconnect: async () => {},
})

export const EthereumProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [provider, setProvider] = useState<EthersWeb3Provider | null>(null)
  const [address, setAddress] = useState<string | null>(null)

  // Connect on every click by dynamically importing Web3Modal
  const connect = async () => {
    if (typeof window === 'undefined') return
    const Web3Modal = (await import('web3modal')).default
    const modal = new Web3Modal({ cacheProvider: true })
    const instance = await modal.connect()
    const web3Provider = new EthersWeb3Provider(instance)
    setProvider(web3Provider)

    const signer = web3Provider.getSigner()
    setAddress(await signer.getAddress())
  }

  // Similarly clear cache on disconnect
  const disconnect = async () => {
    if (typeof window === 'undefined') return
    const Web3Modal = (await import('web3modal')).default
    const modal = new Web3Modal({ cacheProvider: true })
    await modal.clearCachedProvider()
    setProvider(null)
    setAddress(null)
  }

  return (
    <EthContext.Provider value={{ provider, address, connect, disconnect }}>
      {children}
    </EthContext.Provider>
  )
}

export const useEthereum = () => useContext(EthContext)
