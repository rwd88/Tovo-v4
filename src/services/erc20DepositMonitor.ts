import { JsonRpcProvider, Contract } from "ethers";
import { getDepositAddresses, recordDeposit } from "../models/deposit";

// RPC URLs for EVM chains (reuse or import from your other monitor)
const RPC: Record<number, string> = {
  1: process.env.ETH_RPC_URL!,
  56: process.env.BSC_RPC_URL!,
  // add other EVM chain RPCs here
};

// Minimal ERC-20 ABI for Transfer events
const ERC20_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

// Configure which tokens to monitor per chain
interface TokenConfig {
  chainId: number;
  tokenAddress: string;
}

const tokenConfigs: TokenConfig[] = [
  // Example: USDT on Ethereum and BSC
  { chainId: 1,  tokenAddress: process.env.USDT_MAINNET! },
  { chainId: 56, tokenAddress: process.env.USDT_BSC! },
  // add more tokens as needed
];

// Initialize providers
const providers: Record<number, JsonRpcProvider> = Object.fromEntries(
  Object.entries(RPC).map(([chainId, url]) => [
    Number(chainId),
    new JsonRpcProvider(url),
  ])
) as Record<number, JsonRpcProvider>;

export function startErc20DepositMonitor() {
  for (const { chainId, tokenAddress } of tokenConfigs) {
    const provider = providers[chainId];
    const contract = new Contract(tokenAddress, ERC20_ABI, provider);

    console.log(`ERC20 Monitor: listening to ${tokenAddress} on chain ${chainId}`);

    contract.on("Transfer", async (from: string, to: string, value: bigint, event) => {
      try {
        // Only care about incoming transfers
        const depositAddrs = await getDepositAddresses(chainId);
        if (depositAddrs.some(a => a.address.toLowerCase() === to.toLowerCase())) {
          console.log(`Token deposit: ${value.toString()} to ${to} on chain ${chainId}`);

          await recordDeposit({
            chainId,
            address: to,
            amount: value.toString(),
            txHash: event.transactionHash,
            blockNumber: event.blockNumber!,
          });
        }
      } catch (err) {
        console.error("ERC20 deposit handler error", err);
      }
    });
  }
  console.log("ERC20 deposit monitor started");
}

// If run directly for testing
if (require.main === module) {
  startErc20DepositMonitor();
}
