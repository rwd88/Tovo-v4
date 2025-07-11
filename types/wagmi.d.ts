// src/types/wagmi.d.ts

import * as React from 'react'

//
// 1) Top-level “wagmi” exports
//
declare module 'wagmi' {
  export function configureChains(
    chains: any[],
    providers: any[]
  ): {
    publicClient: any
    webSocketPublicClient: any
  }

  export interface CreateConfigArgs {
    autoConnect?: boolean
    connectors?: any[]
    publicClient: any
    webSocketPublicClient?: any
  }
  export function createConfig(args: CreateConfigArgs): any

  export const WagmiConfig: React.FC<{ config: any }>
}

//
// 2) The injected-connector sub-module
//
declare module 'wagmi/connectors/injected' {
  export interface InjectedConnectorOptions {
    chains?: any[]
  }
  export class InjectedConnector {
    constructor(options?: InjectedConnectorOptions)
  }
}

//
// 3) The public-provider sub-module
//
declare module 'wagmi/providers/public' {
  export function publicProvider(): any
}

//
// 4) The chains sub-module (at least “mainnet”)
//
declare module 'wagmi/chains' {
  export const mainnet: any
}
