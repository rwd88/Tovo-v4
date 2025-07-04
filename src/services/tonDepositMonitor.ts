import TonWeb from 'tonweb'
import { PrismaClient } from '@prisma/client'
import { recordDeposit } from './recordDeposit'    // <-- adjust path if needed

const prisma = new PrismaClient()
const TON_RPC_URL      = process.env.TON_RPC_URL!
const TON_CHAIN_ID     = parseInt(process.env.TON_CHAIN_ID  || '', 10)
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '15000', 10)

if (!TON_RPC_URL)   throw new Error('Missing TON_RPC_URL in env')
if (!TON_CHAIN_ID)  throw new Error('Missing TON_CHAIN_ID in env')

const tonweb = new TonWeb(new TonWeb.HttpProvider(TON_RPC_URL))
const cache: Record<string, bigint> = {}

export async function startTonDepositMonitor() {
  console.log('☑️ TON monitor starting—polling every', POLL_INTERVAL_MS, 'ms')

  // fetch all addresses tagged for TON by chainId
  const addrs = await prisma.depositAddress.findMany({
    where: { chainId: TON_CHAIN_ID },
    select: { address: true, lastBalance: true },
  })

  // seed our in-memory cache
  for (const { address, lastBalance } of addrs) {
    cache[address] = BigInt(lastBalance)
  }

  setInterval(async () => {
    for (const { address } of addrs) {
      try {
        const raw     = await tonweb.getBalance(address)
        const balance = BigInt(raw)
        const prev    = cache[address] ?? 0n

        if (balance > prev) {
          const delta = (balance - prev).toString()
          console.log(`🔔 TON deposit ${delta} detected at ${address}`)

          // use your shared helper—creates a deposit row & bumps lastBalance for you
          await recordDeposit({
            chainId:    TON_CHAIN_ID,
            address,
            amount:     delta,
            txHash:     '',     // no txHash from plain balance check
            blockNumber: 0,     // or supply if you have it
          })

          cache[address] = balance
        }
      } catch (e) {
        console.error('❌ TON monitor error for', address, e)
      }
    }
  }, POLL_INTERVAL_MS)
}

// allow `node src/services/tonDepositMonitor.ts` as standalone
if (require.main === module) {
  startTonDepositMonitor().catch(err => {
    console.error(err)
    process.exit(1)
  })
}
