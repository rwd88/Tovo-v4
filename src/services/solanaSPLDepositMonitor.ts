// src/services/solanaSPLDepositMonitor.ts
import { Connection, PublicKey } from "@solana/web3.js";
import { getDepositAddresses, recordDeposit } from "../models/deposit";
import { TOKEN_PROGRAM_ID, AccountLayout } from "@solana/spl-token";

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL!;
if (!SOLANA_RPC_URL) throw new Error("Missing SOLANA_RPC_URL");
const SOLANA_CHAIN_ID = Number(process.env.SOLANA_CHAIN_ID || "101");
const connection = new Connection(SOLANA_RPC_URL, "confirmed");

export async function startSolanaSPLDepositMonitor() {
  console.log("Starting Solana SPL-token monitor…");

  const addrs = await getDepositAddresses(SOLANA_CHAIN_ID);
  const mintPubkey = new PublicKey(process.env.SOLANA_SPL_TOKEN_MINT!);

  connection.onSlotChange(async ({ slot }) => {
    for (const { address, lastBalance } of addrs) {
      try {
        const info = await connection.getAccountInfo(new PublicKey(address));
        if (!info || info.owner.toBase58() !== TOKEN_PROGRAM_ID.toBase58()) continue;

        const data    = Buffer.from(info.data);
        const acct    = AccountLayout.decode(data);
        const balance = BigInt(acct.amount.toString());
        const oldBal  = BigInt(lastBalance);

        if (balance > oldBal) {
          const delta = balance - oldBal;
          console.log(`SPL deposit of ${delta} to ${address}`);
          await recordDeposit({
            chainId:     SOLANA_CHAIN_ID,
            address,
            amount:      delta.toString(),
            txHash:      "",
            blockNumber: slot,
          });
        }
      } catch (e) {
        console.error("SPL monitor error on", address, e);
      }
    }
  });

  console.log("Solana SPL-token deposit monitor started");
}

if (require.main === module) {
  startSolanaSPLDepositMonitor().catch(console.error);
}
