// contexts/TonContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react"
import { TonConnect, TonConnectUIProvider, useTonAddress } from "@tonconnect/ui-react"

type TonContextType = {
  tonAddress: string | null
}

const TonContext = createContext<TonContextType>({ tonAddress: null })

export const TonProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const tonAddress = useTonAddress()

  return (
    <TonContext.Provider value={{ tonAddress }}>
      <TonConnectUIProvider manifestUrl="/tonconnect-manifest.json">
        {children}
      </TonConnectUIProvider>
    </TonContext.Provider>
  )
}

export const useTonWallet = () => useContext(TonContext)
