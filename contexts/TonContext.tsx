// contexts/TonContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { TonConnectUIProvider } from '@tonconnect/ui-react';

type TonContextType = {
  address: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
};

const TonContext = createContext<TonContextType>({
  address: null,
  connect: async () => {},
  disconnect: async () => {},
});

export const TonProvider = ({ children }: { children: ReactNode }) => {
  const [address, setAddress] = useState<string | null>(null);

  return (
    <TonConnectUIProvider manifestUrl="https://your-app.com/tonconnect-manifest.json">
      <TonContext.Provider value={{
        address,
        connect: async () => {
          try {
            // TonConnect will handle connection via its modal
          } catch (error) {
            console.error('TON connection error:', error);
          }
        },
        disconnect: async () => {
          try {
            setAddress(null);
          } catch (error) {
            console.error('TON disconnection error:', error);
          }
        }
      }}>
        {children}
      </TonContext.Provider>
    </TonConnectUIProvider>
  );
};

export const useTon = () => useContext(TonContext);