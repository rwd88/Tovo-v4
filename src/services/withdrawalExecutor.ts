// src/services/withdrawalExecutor.ts

import { PrismaClient } from "@prisma/client";
import {
  JsonRpcProvider,
  Wallet,
  Contract,
  parseEther
} from "ethers";
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction as SolanaTx,
  PublicKey
} from "@solana/web3.js";
import TonWeb from "tonweb";

const prisma = new PrismaClient();

// — EVM setup —
const EVM_RPC_URL      = process.env.ETH_RPC_URL!;
const EVM_PRIVATE_KEY  = process.env.EVM_PRIVATE_KEY!;
const evmProvider      = new JsonRpcProvider(EVM_RPC_URL);
const evmWallet        = new Wallet(EVM_PRIVATE_KEY, evmProvider);

// — Solana setup —
const SOLANA_RPC_URL     = process.env.SOLANA_RPC_URL!;
const SOLANA_PRIVATE_KEY = process.env.SOLANA_PRIVATE_KEY!;
const solConnection      = new Connection(SOLANA_RPC_URL, "confirmed");
const solKeypair         = Keypair.fromSecretKey(
  Buffer.from(JSON.parse(SOLANA_PRIVATE_KEY))
);

// — TON setup —
const TON_RPC_URL     = process.env.TON_RPC_URL!;
const TON_PRIVATE_KEY = process.env.TON_PRIVATE_KEY!;
const tonweb          = new TonWeb(new TonWeb.HttpProvider(TON_RPC_URL));
const tonKeypair = (tonweb as any).utils.KeyPair.fromSecretKey(
Buffer.from(JSON.parse(TON_PRIVATE_KEY).secretKey, "hex")
);

/**
 * Processes pending withdrawals: signs and broadcasts transactions,
 * then updates withdrawal.status accordingly.
 */
export async function executeWithdrawals() {
  const pending = await prisma.withdrawal.findMany({
    where: { status: "pending" }
  });

  for (const w of pending) {
    try {
      let txHash: string;

      if (["1","56"].includes(w.chain)) {
        // EVM native withdrawal
        const tx = await evmWallet.sendTransaction({
          to: w.userId, 
          value: parseEther(w.amount.toString()),
          nonce: await evmProvider.getTransactionCount(evmWallet.address)
        });
        txHash = tx.hash;

      } else if (w.chain === "101") {
        // Solana lamport transfer
        const tx = new SolanaTx().add(
          SystemProgram.transfer({
            fromPubkey: solKeypair.publicKey,
            toPubkey: new PublicKey(w.userId),
            lamports: Number(w.amount),
          })
        );
        tx.feePayer = solKeypair.publicKey;
        const { blockhash } = await solConnection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.sign(solKeypair);
        const raw = tx.serialize();
        txHash = await solConnection.sendRawTransaction(raw, { skipPreflight: true });

      } else if (w.chain === "102") {
        // TON transfer (nanograms)
        const walletContract = tonweb.wallet.create({
          publicKey: tonKeypair.publicKey
        });
        const seqno = await walletContract.methods.seqno().call();
        const transfer = walletContract.methods.transfer({
          secretKey: tonKeypair.secretKey,
          toAddress: w.userId,
          amount: w.amount.toString(),
          seqno,
          sendMode: 3,
        });
        const result = await transfer.send();
        txHash = result.transaction.id;

      } else {
        throw new Error(`Unsupported chain: ${w.chain}`);
      }

      // Mark as signed
      await prisma.withdrawal.update({
        where: { id: w.id },
        data: { status: "signed" }
      });

      // Wait for confirmation
      if (["1","56"].includes(w.chain)) {
        await evmProvider.waitForTransaction(txHash, 1);
      } else if (w.chain === "101") {
        await solConnection.confirmTransaction(txHash);
      }

      // Mark completed
      await prisma.withdrawal.update({
        where: { id: w.id },
        data: { status: "completed" }
      });

      console.log(`Withdrawal ${w.id} completed: ${txHash}`);

    } catch (err) {
      console.error(`Withdrawal ${w.id} failed`, err);
      await prisma.withdrawal.update({
        where: { id: w.id },
        data: { status: "failed" }
      });
    }
  }
}

// If run directly, execute once then exit
if (require.main === module) {
  executeWithdrawals()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
