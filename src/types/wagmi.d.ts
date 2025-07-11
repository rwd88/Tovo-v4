// src/types/wagmi.d.ts
import * as React from 'react';

declare module 'wagmi' {
  // the core setup functions you use
  export function configureChains(
    chains: any[],
    providers: any[]
  ): {
    publicClient: any;
    webSocketPublicClient: any;
  };

  export interface CreateConfigArgs {
    autoConnect?: boolean;
    connectors?: any[];
    publicClient: any;
    webSocketPublicClient?: any;
  }
  export function createConfig(args: CreateConfigArgs): any;

  export const WagmiConfig: React.FC<{ config: any }>;

  // re-export whatever else you import directly
  export * from 'wagmi/chains';
  export * from 'wagmi/connectors/injected';
  export * from 'wagmi/providers/public';
}
