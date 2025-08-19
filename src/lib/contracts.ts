// src/lib/contracts.ts
// Uses the artifact written by /contracts/scripts/deploy.ts
// Current deploy: MAINNET (Counter)

import counterMainnet from "../../contracts-out/Counter.mainnet.json";

// Re-export as strongly-typed values your app can use everywhere
export const CONTRACT_ADDRESS = counterMainnet.address as `0x${string}`;
export const CONTRACT_ABI = counterMainnet.abi;

// Helpful metadata for UI/logging
export const CONTRACT_NAME = "Counter";
export const CONTRACT_NETWORK = "mainnet" as const;

// If you later deploy PredictionMarket, replace the import with:
// import pmMainnet from "../../contracts-out/PredictionMarket.mainnet.json";
// export const CONTRACT_ADDRESS = pmMainnet.address as `0x${string}`;
// export const CONTRACT_ABI = pmMainnet.abi;
// export const CONTRACT_NAME = "PredictionMarket";
