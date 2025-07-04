import TonWeb from 'tonweb';
import { getDepositAddresses, recordDeposit } from '../models/deposit';

const TON_RPC_URL      = process.env.NEXT_PUBLIC_TON_RPC_URL!;
const TON_CHAIN_ID     = Number(process.env.TON_CHAIN_ID);
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || '15000');

if (!TON_RPC_URL) {
  throw new Error('Missing NEXT_PUBLIC_TON_RPC_URL in environment');
}

const tonweb = new TonWeb(new TonWeb.HttpProvider(TON_RPC_URL));

const lastBalances: Record<string, bigint> = {};

export async function startTonDepositMonitor() {
  console.log('Starting TON deposit monitor on', TON_RPC_URL);

  // 1) Load addresses from DB
  const addresses = await getDepositAddresses(TON_CHAIN_ID);

  // 2) Initialize in-memory balances
  for (const addr of addresses) {
    lastBalances[addr.address] = BigInt(addr.lastBalance);
  }

  // 3) Poll loop
  setInterval(async () => {
    for (const addr of addresses) {
      try {
        const balanceStr = await tonweb.getBalance(addr.address);
        const balance    = BigInt(balanceStr);
        const oldBal     = lastBalances[addr.address] ?? BigInt(0);

        if (balance > oldBal) {
          const delta = (balance - oldBal).toString();
          console.log(`Detected TON deposit of ${delta} to ${addr.address}`);

          await recordDeposit({
            chainId:     TON_CHAIN_ID,
            address:     addr.address,
            amount:      delta,
            txHash:      '',
            blockNumber: 0,
          });

          lastBalances[addr.address] = balance;
        }
      } catch (err) {
        console.error('TON monitor error for', addr.address, err);
      }
    }
  }, POLL_INTERVAL_MS);

  console.log('TON deposit monitor started');
}

if (require.main === module) {
  startTonDepositMonitor().catch((err) => {
    console.error('TON monitor failed:', err);
    process.exit(1);
  });
}