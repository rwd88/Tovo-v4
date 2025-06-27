import { Connection, PublicKey } from '@solanaweb3.js';
import { getDepositAddresses, recordDeposit } from '..modelsdeposit';
import { TOKEN_PROGRAM_ID } from '@solanaspl-token';

 Load configuration
const SOLANA_RPC_URL        = process.env.SOLANA_RPC_URL!;                e.g. httpsapi.mainnet-beta.solana.com
const SOLANA_CHAIN_ID       = Number(process.env.SOLANA_CHAIN_ID);         e.g. 101
const POLL_INTERVAL_MS      = Number(process.env.SOLANA_POLL_INTERVAL_MS)  15000;
const SPL_TOKEN_MINTS       = (process.env.SPL_TOKEN_MINTS  '').split(',').filter(Boolean);

 Initialize connection
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

 Check native SOL deposits
async function checkNativeSol() {
  const addrs = await getDepositAddresses(SOLANA_CHAIN_ID);
  for (const { address, lastBalance } of addrs) {
    const pubkey = new PublicKey(address);
    const balanceLamports = await connection.getBalance(pubkey);
    const oldBal = BigInt(lastBalance);
    const newBal = BigInt(balanceLamports);
    if (newBal  oldBal) {
      const delta = newBal - oldBal;
      console.log(`Solana native deposit ${delta} lamports to ${address}`);
      await recordDeposit({ chainId SOLANA_CHAIN_ID, address, amount delta.toString(), txHash '', blockNumber 0 });
    }
  }
}

 Check SPL token deposits
async function checkSplTokens() {
  if (!SPL_TOKEN_MINTS.length) return;

  const addrs = await getDepositAddresses(SOLANA_CHAIN_ID);
  for (const mint of SPL_TOKEN_MINTS) {
    const mintKey = new PublicKey(mint);
    for (const { address, lastBalance } of addrs) {
      const ownerKey = new PublicKey(address);
       get token accounts for this owner and mint
      const tokenAccounts = await connection.getTokenAccountsByOwner(ownerKey, { mint mintKey });
      let total = BigInt(0);
      for (const acct of tokenAccounts.value) {
        const info = acct.account.data;
         account data layout skip header, parse uint64 at offset 64
        const amount = BigInt(new Buffer(info).readBigUInt64LE(64));
        total += amount;
      }
      const oldBal = BigInt(lastBalance);
      if (total  oldBal) {
        const delta = total - oldBal;
        console.log(`SPL deposit ${delta} tokens (mint ${mint}) to ${address}`);
        await recordDeposit({ chainId SOLANA_CHAIN_ID, address, amount delta.toString(), txHash '', blockNumber 0 });
      }
    }
  }
}

 Start Solana deposit monitor with polling
export function startSolanaDepositMonitor() {
  console.log(`Starting Solana deposit monitor at ${SOLANA_RPC_URL}`);
  setInterval(async () = {
    try {
      await checkNativeSol();
      await checkSplTokens();
    } catch (err) {
      console.error('Solana monitor error', err);
    }
  }, POLL_INTERVAL_MS);
}

 If run directly for testing
if (require.main === module) {
  startSolanaDepositMonitor();
}
