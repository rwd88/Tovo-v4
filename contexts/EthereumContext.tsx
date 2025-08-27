// contexts/EthereumContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { BrowserProvider } from 'ethers'

type EthereumCtx = {
  provider: BrowserProvider | null
  isClient: boolean
  hasWallet: boolean
  chainId: number | null
}

const defaultCtx: EthereumCtx = {
  provider: null,
  isClient: false,
  hasWallet: false,
  chainId: null,
}

const Ctx = createContext<EthereumCtx>(defaultCtx)

/**
 * SSR-safe provider:
 * - Never accesses window during SSR.
 * - Initializes provider on client in useEffect.
 */
export function EthereumProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<EthereumCtx>(defaultCtx)

  useEffect(() => {
    let mounted = true
    const eth = (globalThis as any)?.ethereum

    async function init() {
      if (!mounted) return
      if (!eth) {
        setState((s) => ({ ...s, isClient: true, hasWallet: false }))
        return
      }
      try {
        const provider = new BrowserProvider(eth)
        const net = await provider.getNetwork().catch(() => null)
        if (!mounted) return
        setState({
          provider,
          isClient: true,
          hasWallet: true,
          chainId: net ? Number(net.chainId) : null,
        })

        // keep chainId in sync
        const onChainChanged = (hexId: string) => {
          if (!mounted) return
          const id = parseInt(hexId, 16)
          setState((s) => ({ ...s, chainId: id }))
        }
        eth.on?.('chainChanged', onChainChanged)
        return () => eth.removeListener?.('chainChanged', onChainChanged)
      } catch {
        setState((s) => ({ ...s, isClient: true, hasWallet: false }))
      }
    }

    init()
    return () => {
      mounted = false
    }
  }, [])

  const value = useMemo(() => state, [state.provider, state.isClient, state.hasWallet, state.chainId])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/**
 * Hook never throws; returns safe defaults on SSR.
 */
export function useEthereum(): EthereumCtx {
  return useContext(Ctx)
}
