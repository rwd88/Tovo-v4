// src/services/solanaDepositMonitor.ts

import { Connection, PublicKey } from "@solana/web3.js";
import { getDepositAddresses, recordDeposit } from "../models/deposit";

// Load RPC URL from environment
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL!;
if (!SOLANA_RPC_URL) {
  throw new Error("Missing SOLANA_RPC_URL environment variable");
}

// Use a unique chainId for Solana, e.g. 101
const SOLANA_CHAIN_ID = Number(process.env.SOLANA_CHAIN_ID || "101");

// Initialize Solana connection
const connection = new Connection(SOLANA_RPC_URL, "confirmed");

/**
 * Starts monitoring Solana deposit addresses for incoming lamports.
 */
export async function startSolanaDepositMonitor() {
  console.log("Starting Solana deposit monitor on RPC:", SOLANA_RPC_URL);

  // Fetch deposit addresses configured for Solana
  const addresses = await getDepositAddresses(SOLANA_CHAIN_ID);

  // Subscribe to slot changes (confirmed)
  connection.onSlotChange(async ({ slot }) => {
    console.log(`Solana Monitor: slot ${slot} update`);

    for (const addr of addresses) {
      try {
        const pubkey = new PublicKey(addr.address);
        const balance = await connection.getBalance(pubkey, "confirmed"); // lamports
        const oldBalance = BigInt(addr.lastBalance);
        const newBalance = BigInt(balance);

        if (newBalance > oldBalance) {
          const delta = newBalance - oldBalance;
          console.log(`Detected deposit of ${delta.toString()} lamports to ${addr.address}`);

          await recordDeposit({
            chainId: SOLANA_CHAIN_ID,
            address: addr.address,
            amount: delta.toString(),
            txHash: "",          // slot subscription does not provide txHash
            blockNumber: Number(slot),
          });
        }
      } catch (err) {
        console.error("Solana deposit error for address", addr.address, err);
      }
    }
  });

  console.log("Solana deposit monitor started");
}

// If the module is run directly, start the monitor
if (require.main === module) {
  startSolanaDepositMonitor().catch((err) => {
    console.error("Solana monitor failed:", err);
    process.exit(1);
  });
}
