// src/services/solanaSPLDepositMonitor.ts

import { Connection, PublicKey } from "@solana/web3.js";
import { getDepositAddresses, recordDeposit } from "../models/deposit";
import { TOKEN_PROGRAM_ID, AccountLayout } from "@solana/spl-token";

// Load RPC URL
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL!;
if (!SOLANA_RPC_URL) {
  throw new Error("Missing SOLANA_RPC_URL");
}

// Use same chainId as your lamport monitor
const SOLANA_CHAIN_ID = Number(process.env.SOLANA_CHAIN_ID || "101");
const connection     = new Connection(SOLANA_RPC_URL, "confirmed");

/**
 * Starts monitoring SPL-token account balances for deposit addresses.
 */
export async function startSolanaSPLDepositMonitor() {
  console.log("📝 Starting Solana SPL-token monitor…");

  // 1) Fetch all deposit addresses for your SPL-token (chainId=101)
  const addrs = await getDepositAddresses(SOLANA_CHAIN_ID);

  // 2) Poll on each new slot
  connection.onSlotChange(async ({ slot }) => {
    console.log(`🔄 SPL Monitor slot ${slot}`);

    for (const { address, lastBalance } of addrs) {
      try {
        const info = await connection.getAccountInfo(new PublicKey(address), "confirmed");
        // skip non-token accounts
        if (!info || info.owner.toBase58() !== TOKEN_PROGRAM_ID.toBase58()) continue;

        // decode token-account data
        const data    = Buffer.from(info.data);
        const acct    = AccountLayout.decode(data);
        const balance = BigInt(acct.amount.toString());
        const oldBal  = BigInt(lastBalance);

        // if we received more tokens
        if (balance > oldBal) {
          const delta = balance - oldBal;
          console.log(`✅ SPL deposit ${delta.toString()} to ${address}`);

          await recordDeposit({
            chainId:     SOLANA_CHAIN_ID,
            address,
            amount:      delta.toString(),
            txHash:      "",         // no txHash via slot
            blockNumber: slot,
          });
        }
      } catch (err) {
        console.error("❌ SPL monitor error for", address, err);
      }
    }
  });

  console.log("✅ Solana SPL-token deposit monitor started");
}

// Allow running standalone for testing
if (require.main === module) {
  startSolanaSPLDepositMonitor().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
