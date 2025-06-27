import { JsonRpcProvider } from "ethers";
import { getDepositAddresses, recordDeposit } from "../models/deposit";

// Load RPC URLs from env
const RPC: Record<number, string> = {
  1: process.env.ETH_RPC_URL!,    // Ethereum Mainnet
  56: process.env.BSC_RPC_URL!,   // BSC Mainnet
  // add additional networks here
};

// Initialize providers per chain
interface ChainConfig {
  chainId: number;
  provider: JsonRpcProvider;
}
const chains: ChainConfig[] = Object.entries(RPC).map(([chainId, url]) => ({
  chainId: Number(chainId),
  provider: new JsonRpcProvider(url),
}));

// Track last processed block per chain (persist externally in prod)
const lastProcessed: Record<number, number> = {};

export async function startEvmDepositMonitor() {
  for (const { chainId, provider } of chains) {
    // Seed starting block
    lastProcessed[chainId] = await provider.getBlockNumber();

    // Listen for new blocks
    provider.on("block", async (blockNumber: number) => {
      if (blockNumber <= lastProcessed[chainId]) return;
      console.log(`EVM Monitor: new block ${blockNumber} on chain ${chainId}`);

      const addrs = await getDepositAddresses(chainId);
      for (const { address, lastBalance } of addrs) {
        const balance = await provider.getBalance(address);       // bigint
        const oldBal = BigInt(lastBalance);                       // bigint
        if (balance > oldBal) {
          const delta = balance - oldBal;
          console.log(`Deposit detected: ${delta} Wei to ${address}`);

          await recordDeposit({
            chainId,
            address,
            amount: delta.toString(),
            txHash: "",           // optionally fill from logs
            blockNumber,
          });
        }
      }

      lastProcessed[chainId] = blockNumber;
    });
  }
  console.log("EVM deposit monitor started");
}

// If run directly
if (require.main === module) {
  startEvmDepositMonitor().catch(console.error);
}
