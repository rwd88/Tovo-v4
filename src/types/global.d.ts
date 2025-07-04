// src/types/global.d.ts
import { TonProvider } from 'ton-inpage-provider';

declare global {
  interface Window {
    ton: TonProvider;
  }
}

export {};