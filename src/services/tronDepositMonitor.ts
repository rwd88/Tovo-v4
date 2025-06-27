import TronWeb from "tronweb";
import { getDepositAddresses, recordDeposit } from "../models/deposit";

// Configure Tron node URL & polling interval
const TRON_NODE_URL = process.env.TRON_NODE_URL!;        // e.g. https://api.trongrid.io
const POLL_INTERVAL_MS = Number(process.env.TRON_POLL_INTERVAL_MS) || 15000;
// Define a chainId for Tron in your deposit addresses table
const TRON_CHAIN_ID = Number(process.env.TRON_CHAIN_ID) || 100;

// Optional: list of TRC-20 tokens to monitor on Tron
const TRC20_TOKENS: string[] = (process.env.TRC20_TOKEN_ADDRESSES || "").split(",").filter(Boolean);

const tronWeb = new TronWeb({ fullHost: TRON_NODE_URL });

async function checkNativeDeposits() {
  const addrs = await getDepositAddresses(TRON_CHAIN_ID);
  for (const { address, lastBalance } of addrs) {
    // getBalance returns balance in sun (1 TRX = 1e6 sun)
    const balanceSun = await tronWeb.trx.getBalance(address);
    const oldBal = BigInt(lastBalance);
    const newBal = BigInt(balanceSun);
    if (newBal > oldBal) {
      const delta = newBal - oldBal;
      console.log(`Tron deposit: ${delta} sun to ${address}`);
      await recordDeposit({
        chainId: TRON_CHAIN_ID,
        address,
        amount: delta.toString(),
        txHash: "",      // optional: fetch tx via events or RPC
        blockNumber: 0,    // Tron doesn't use blockNumber here; pass 0 or fetch latest
      });
    }
  }
}

async function checkTrc20Deposits() {
  if (!TRC20_TOKENS.length) return;
  const addrs = await getDepositAddresses(TRON_CHAIN_ID);
  for (const tokenAddress of TRC20_TOKENS) {
    const contract = await tronWeb.contract().at(tokenAddress);
    for (const { address, lastBalance } of addrs) {
      try {
        // balanceOf returns a promise for a BigNumber-like string
        const balStr = await contract.methods.balanceOf(address).call();
        const newBal = BigInt(balStr);
        const oldBal = BigInt(lastBalance);
        if (newBal > oldBal) {
          const delta = newBal - oldBal;
          console.log(`Trc20 deposit: ${delta} (token ${tokenAddress}) to ${address}`);
          await recordDeposit({
            chainId: TRON_CHAIN_ID,
            address,
            amount: delta.toString(),
            txHash: "",
            blockNumber: 0,
          });
        }
      } catch (err) {
        console.error(`Error checking TRC20 ${tokenAddress} on ${address}`, err);
      }
    }
  }
}

export function startTronDepositMonitor() {
  console.log(`Starting Tron deposit monitor on ${TRON_NODE_URL}`);
  // Poll at interval
  setInterval(async () => {
    try {
      await checkNativeDeposits();
      await checkTrc20Deposits();
    } catch (err) {
      console.error("Tron monitor error", err);
    }
  }, POLL_INTERVAL_MS);
}

// If run directly
if (require.main === module) {
  startTronDepositMonitor();
}
