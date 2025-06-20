// contexts/EthereumContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react'
import { Web3Provider as EthersWeb3Provider } from '@ethersproject/providers'

type EthContextType = {
  provider: EthersWeb3Provider | null
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

export const EthereumProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [provider, setProvider] = useState<EthersWeb3Provider | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [web3Modal, setWeb3Modal] = useState<any>(null)

  // Only run in browser
  useEffect(() => {
    if (typeof window === 'undefined') return

    import('web3modal').then(({ default: Web3Modal }) => {
      const modal = new Web3Modal({ cacheProvider: true })
      setWeb3Modal(modal)

      // Auto-reconnect
      if (modal.cachedProvider) {
        modal
          .connect()
          .then((instance: any) => {
            const web3provider = new EthersWeb3Provider(instance)
            setProvider(web3provider)
            return web3provider.getSigner().getAddress()
          })
          .then(setAddress)
          .catch(console.error)
      }
    })
  }, [])

  const connect = async () => {
    if (!web3Modal) return
    const instance = await web3Modal.connect()
    const web3provider = new EthersWeb3Provider(instance)
    setProvider(web3provider)
    const signer = web3provider.getSigner()
    setAddress(await signer.getAddress())
  }

  const disconnect = () => {
    web3Modal?.clearCachedProvider()
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
