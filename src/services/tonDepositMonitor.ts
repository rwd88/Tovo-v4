import TonWeb from 'tonweb';
import { getDepositAddresses, recordDeposit } from '../models/deposit';

const TON_RPC_URL      = process.env.NEXT_PUBLIC_TON_RPC_URL!;
const TON_CHAIN_ID     = Number(process.env.TON_CHAIN_ID);
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || '15000');

if (!TON_RPC_URL) throw new Error('Missing NEXT_PUBLIC_TON_RPC_URL');

const tonweb = new TonWeb(new TonWeb.HttpProvider(TON_RPC_URL));
const lastBalances: Record<string, bigint> = {};

export async function startTonDepositMonitor() {
  console.log('TON monitor running on', TON_RPC_URL);
  const addrs = await getDepositAddresses(TON_CHAIN_ID);
  addrs.forEach(a => lastBalances[a.address] = BigInt(a.lastBalance));

  setInterval(async () => {
    for (const a of addrs) {
      try {
        const balStr = await tonweb.getBalance(a.address);
        const bal    = BigInt(balStr);
        const old    = lastBalances[a.address] || BigInt(0);
        if (bal > old) {
          const delta = (bal - old).toString();
          console.log(`➕ TON Deposit ${delta} to ${a.address}`);
          await recordDeposit({ chainId: TON_CHAIN_ID, address: a.address, amount: delta, txHash: '', blockNumber: 0 });
          lastBalances[a.address] = bal;
        }
      } catch (e) {
        console.error('TON error', a.address, e);
      }
    }
  }, POLL_INTERVAL_MS);
}

if (require.main === module) startTonDepositMonitor().catch(console.error);