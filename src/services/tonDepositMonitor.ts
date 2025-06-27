// src/services/tonDepositMonitor.ts

import TonWeb from "tonweb";
import { getDepositAddresses, recordDeposit } from "../models/deposit";

// Load env vars
const TON_RPC_URL      = process.env.TON_RPC_URL!;
const TON_CHAIN_ID     = Number(process.env.TON_CHAIN_ID || "102");
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || "15000");

if (!TON_RPC_URL) {
  throw new Error("Missing TON_RPC_URL in .env.local");
}

// Initialize TonWeb with HTTP provider
const tonweb = new TonWeb(new TonWeb.HttpProvider(TON_RPC_URL));

// In-memory last‐balance state
const lastBalances: Record<string, bigint> = {};

/**
 * Polls each deposit address on TON every POLL_INTERVAL_MS.
 */
export async function startTonDepositMonitor() {
  console.log("Starting TON deposit monitor on", TON_RPC_URL);

  // Fetch all deposit addresses for TON
  const addresses = await getDepositAddresses(TON_CHAIN_ID);

  // Seed our in-memory state
  for (const addr of addresses) {
    lastBalances[addr.address] = BigInt(addr.lastBalance);
  }

  // Poll loop
  setInterval(async () => {
    for (const addr of addresses) {
      try {
        // tonweb.getBalance returns a string of nanograms
        const balanceStr = await tonweb.getBalance(addr.address);
        const balance = BigInt(balanceStr);
        const oldBal  = lastBalances[addr.address] ?? BigInt(0);

        if (balance > oldBal) {
          const delta = balance - oldBal;
          console.log(`Detected TON deposit of ${delta} to ${addr.address}`);

          // Record the deposit (we don't have a blockNumber here, so 0)
          await recordDeposit({
            chainId:    TON_CHAIN_ID,
            address:    addr.address,
            amount:     delta.toString(),
            txHash:     "",
            blockNumber: 0,
          });

          // Update our local cache
          lastBalances[addr.address] = balance;
        }
      } catch (err) {
        console.error("TON monitor error for", addr.address, err);
      }
    }
  }, POLL_INTERVAL_MS);

  console.log("TON deposit monitor started");
}

// If run directly, kick it off
if (require.main === module) {
  startTonDepositMonitor().catch((err) => {
    console.error("TON monitor failed:", err);
    process.exit(1);
  });
}
