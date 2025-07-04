import TonWeb from 'tonweb';
import { getDepositAddresses, recordDeposit } from '../models/deposit';

const TON_RPC_URL      = process.env.NEXT_PUBLIC_TON_RPC_URL!;
const TON_CHAIN_ID     = Number(process.env.TON_CHAIN_ID);
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || '15000');

if (!TON_RPC_URL) {
  throw new Error('Missing NEXT_PUBLIC_TON_RPC_URL');
}

const tonweb = new TonWeb(new TonWeb.HttpProvider(TON_RPC_URL));
const lastBalances: Record<string, bigint> = {};

export async function startTonDepositMonitor() {
  console.log('➤ TON monitor running on', TON_RPC_URL);
  const addresses = await getDepositAddresses(TON_CHAIN_ID);
  addresses.forEach(a => lastBalances[a.address] = BigInt(a.lastBalance));

  setInterval(async () => {
    for (const addr of addresses) {
      try {
        const balStr = await tonweb.getBalance(addr.address);
        const bal = BigInt(balStr);
        const old = lastBalances[addr.address] || BigInt(0);
        if (bal > old) {
          const delta = (bal - old).toString();
          console.log(`➕ TON deposit ${delta} to ${addr.address}`);
          await recordDeposit({
            chainId: TON_CHAIN_ID,
            address: addr.address,
            amount: delta,
            txHash: '',
            blockNumber: 0,
          });
          lastBalances[addr.address] = bal;
        }
      } catch (err) {
        console.error('TON monitor error for', addr.address, err);
      }
    }
  }, POLL_INTERVAL_MS);
}

if (require.main === module) {
  startTonDepositMonitor().catch(err => {
    console.error('TON deposit monitor failed:', err);
    process.exit(1);
  });
}
