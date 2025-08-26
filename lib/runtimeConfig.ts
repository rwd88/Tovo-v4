// src/lib/runtimeConfig.ts
const toAddr = (v?: string) =>
  v && /^0x[a-fA-F0-9]{40}$/.test(v) ? (v as `0x${string}`) : undefined;

export const RUNTIME = {
  MARKET: toAddr(process.env.NEXT_PUBLIC_MARKET_ADDRESS),
  USDC: toAddr(process.env.NEXT_PUBLIC_USDC_ADDRESS), // undefined in ETH mode
  CHAIN_ID: Number(process.env.NEXT_PUBLIC_ETH_CHAIN_ID ?? '11155111'),
} as const;
