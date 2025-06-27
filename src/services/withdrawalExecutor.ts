import { PrismaClient, Withdrawal } from "@prisma/client";
import { providers, Wallet, Contract } from "ethers";
import { Connection, Keypair, SystemProgram, Transaction as SolanaTx } from "@solana/web3.js";
import TonWeb from "tonweb";

const prisma = new PrismaClient();

// Load EVM signer
const EVM_RPC_URL = process.env.ETH_RPC_URL!;
const EVM_PRIVATE_KEY = process.env.EVM_PRIVATE_KEY!;
const evmProvider = new providers.JsonRpcProvider(EVM_RPC_URL);
const evmWallet = new Wallet(EVM_PRIVATE_KEY, evmProvider);

// Load Solana signer
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL!;
const SOLANA_PRIVATE_KEY = process.env.SOLANA_PRIVATE_KEY!;
const solConnection = new Connection(SOLANA_RPC_URL, "confirmed");
const solKeypair = Keypair.fromSecretKey(Buffer.from(JSON.parse(SOLANA_PRIVATE_KEY)));

// Load TON signer
const TON_RPC_URL = process.env.TON_RPC_URL!;
const TON_PRIVATE_KEY = process.env.TON_PRIVATE_KEY!;
const tonweb = new TonWeb(new TonWeb.HttpProvider(TON_RPC_URL));
const tonKeypair = TonWeb.utils.KeyPair.fromSecretKey(
  Buffer.from(JSON.parse(TON_PRIVATE_KEY).secretKey, "hex")
);

/**
 * Processes pending withdrawals: signs and broadcasts transactions,
 * then updates withdrawal.status accordingly.
 */
export async function executeWithdrawals() {
  // 1. Fetch pending withdrawals
  const pending = await prisma.withdrawal.findMany({
    where: { status: "pending" }
  });

  for (const w of pending) {
    try {
      let txHash: string;

      if (w.chain === "1" || w.chain === "56") {
        // EVM native withdrawal
        const tx = await evmWallet.sendTransaction({
          to: w.userId, // Assuming userId stores withdrawal address
          value: providers.parseEther(w.amount.toString()),
          nonce: await evmProvider.getTransactionCount(evmWallet.address),
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
        const { blockhash } = await solConnection.getRecentBlockhash();
        tx.recentBlockhash = blockhash;
        tx.sign(solKeypair);
        const raw = tx.serialize();
        txHash = await solConnection.sendRawTransaction(raw, { skipPreflight: true });
      } else if (w.chain === "102") {
        // TON transfer (nanograms)
        const keyPair = tonKeypair;
        const walletContract = tonweb.wallet.create({ publicKey: keyPair.publicKey });
        const seqno = await walletContract.methods.seqno().call();
        const transfer = walletContract.methods.transfer({
          secretKey: keyPair.secretKey,
          toAddress: w.userId,
          amount: w.amount.toString(),  // amount in nanograms
          seqno: seqno,
          sendMode: 3,
        });
        const result = await transfer.send();
        txHash = result.transaction.id; // or result.transaction_hash
      } else {
        throw new Error(`Unsupported chain: ${w.chain}`);
      }

      // 2. Update status to signed
      await prisma.withdrawal.update({
        where: { id: w.id },
        data: { status: "signed", updatedAt: new Date() },
      });

      console.log(`Withdrawal ${w.id} signed: ${txHash}`);

      // 3. Wait for confirmation (simple)
      if (w.chain === "1" || w.chain === "56") {
        await evmProvider.waitForTransaction(txHash, 1);
      } else if (w.chain === "101") {
        await solConnection.confirmTransaction(txHash);
      }
      // TON: assume immediate

      // 4. Mark completed
      await prisma.withdrawal.update({
        where: { id: w.id },
        data: { status: "completed", updatedAt: new Date() },
      });

      console.log(`Withdrawal ${w.id} completed`);
    } catch (err) {
      console.error("Withdrawal execution failed for", w.id, err);
      await prisma.withdrawal.update({
        where: { id: w.id },
        data: { status: "failed", updatedAt: new Date() },
      });
    }
  }
}

// Run periodically or call from cron
if (require.main === module) {
  executeWithdrawals()
    .then(() => console.log("Withdrawal executor finished"))
    .catch(console.error)
    .finally(() => process.exit(0));
}
