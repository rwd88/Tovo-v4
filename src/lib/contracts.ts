// src/lib/contracts.ts

// You can load from env or from artifacts JSON
export const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_MARKET_ADDRESS || "0x0000000000000000000000000000000000000000";

// If you want ABI support too
import CounterSepolia from "../../contracts-out/Counter.sepolia.json";
import CounterMainnet from "../../contracts-out/Counter.mainnet.json";

export const CONTRACT_ABI =
  process.env.NEXT_PUBLIC_ETH_CHAIN_ID === "1"
    ? CounterMainnet.abi
    : CounterSepolia.abi;
