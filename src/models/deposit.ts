import { JsonRpcProvider } from "ethers";
import { getDepositAddresses, recordDeposit } from "../models/deposit";

// RPC URLs for EVM chains
const RPC: Record<number, string> = {
  1: process.env.ETH_RPC_URL!,
  56: process.env.BSC_RPC_URL!,
  // add other EVM chain RPCs here
};

interface ChainConfig {
  chainId: number;
  provider: JsonRpcProvider;
}

// Initialize providers
const chains: ChainConfig[] = Object.entries(RPC).map(([chainId, url]) => ({
  chainId: Number(chainId),
  provider: new JsonRpcProvider(url),
}));

// Last processed block per chain (persist externally in production)
const lastProcessed: Record<number, number> = {};

export async function startEvmDepositMonitor() {
  for (const { chainId, provider } of chains) {
    // Initialize last processed block
    lastProcessed[chainId] = await provider.getBlockNumber();

    // Listen for new blocks
    provider.on("block", async (blockNumber: number) => {
      if (blockNumber <= lastProcessed[chainId]) return;
      console.log(`New block ${blockNumber} on chain ${chainId}`);

      // Fetch deposit addresses
      const addresses = await getDepositAddresses(chainId);

      for (const addr of addresses) {
        // Check balance (returns bigint in v6)
        const balance = await provider.getBalance(addr.address);
        const oldBalance = BigInt(addr.lastBalance);

        if (balance > oldBalance) {
          const delta = balance - oldBalance;
          console.log(`Detected deposit of ${delta} Wei to ${addr.address}`);

          // Record deposit
          await recordDeposit({
            chainId,
            address: addr.address,
            amount: delta.toString(),
            txHash: "",
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
