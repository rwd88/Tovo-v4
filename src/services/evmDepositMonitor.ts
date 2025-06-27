import { ethers } from "ethers";
import { getDepositAddresses, recordDeposit } from "../models/deposit"; // pseudo-ORM functions

// RPC URLs for EVM chains
const RPC: Record<number, string> = {
  1: process.env.ETH_RPC_URL!,       // Ethereum Mainnet
  56: process.env.BSC_RPC_URL!,      // BSC Mainnet
  // add other EVM chain RPCs here
};

interface ChainConfig {
  chainId: number;
  provider: ethers.providers.JsonRpcProvider;
}

// Initialize providers
const chains: ChainConfig[] = Object.entries(RPC).map(([chainId, url]) => ({
  chainId: Number(chainId),
  provider: new ethers.providers.JsonRpcProvider(url),
}));

// Last processed block per chain (should be persisted in DB in production)
const lastProcessed: Record<number, number> = {};

async function startEvmDepositMonitor() {
  for (const { chainId, provider } of chains) {
    // Initialize last processed block
    lastProcessed[chainId] = await provider.getBlockNumber();

    // Poll for new blocks
    provider.on("block", async (blockNumber: number) => {
      if (blockNumber <= lastProcessed[chainId]) return;
      console.log(`New block ${blockNumber} on chain ${chainId}`);

      // Fetch deposit addresses for this chain
      const addresses = await getDepositAddresses(chainId);

      // For each address, check for balance changes
      for (const addr of addresses) {
        const balance = await provider.getBalance(addr.address);
        const oldBalance = addr.lastBalance;

        if (balance.gt(oldBalance)) {
          const delta = balance.sub(oldBalance);
          console.log(`Detected deposit of ${ethers.utils.formatEther(delta)} to ${addr.address}`);

          // Record deposit in DB
          await recordDeposit({
            chainId,
            address: addr.address,
            amount: delta.toString(),
            txHash: "", // optional: scan blocks for txs or store separately
            blockNumber,
          });

          // Update lastBalance in DB (not shown)
        }
      }

      lastProcessed[chainId] = blockNumber;
    });
  }

  console.log("EVM deposit monitor started");
}

// If this file is run directly
if (require.main === module) {
  startEvmDepositMonitor().catch(console.error);
}

export { startEvmDepositMonitor };
