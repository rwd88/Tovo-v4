// src/services/tonDepositMonitor.ts

import TonWeb from 'tonweb'
import { PrismaClient } from '@prisma/client'
import { recordDeposit } from '../models/deposit'

const prisma = new PrismaClient()
const TON_RPC_URL      = process.env.TON_RPC_URL!
const TON_CHAIN_ID     = parseInt(process.env.TON_CHAIN_ID  || '', 10)
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '15000', 10)

if (!TON_RPC_URL)   throw new Error('Missing TON_RPC_URL in environment')
if (!TON_CHAIN_ID)  throw new Error('Missing TON_CHAIN_ID in environment')

const tonweb = new TonWeb(new TonWeb.HttpProvider(TON_RPC_URL))
// in-memory balance cache
const cache: Record<string, bigint> = {}
// fallback zero value
const ZERO = BigInt(0)

export async function startTonDepositMonitor() {
  console.log('☑️ TON monitor starting—polling every', POLL_INTERVAL_MS, 'ms')

  // load all known TON deposit-addresses
  const addrs = await prisma.depositAddress.findMany({
    where:  { chainId: TON_CHAIN_ID },
    select: { address: true, lastBalance: true },
  })

  // seed cache
  for (const { address, lastBalance } of addrs) {
    cache[address] = BigInt(lastBalance)
  }

  setInterval(async () => {
    for (const { address } of addrs) {
      try {
        const raw     = await tonweb.getBalance(address)
        const balance = BigInt(raw)
        // use nullish coalescing so we only fallback if undefined
        const prev    = cache[address] ?? ZERO

        if (balance > prev) {
          const delta = (balance - prev).toString()
          console.log(`🔔 TON deposit ${delta} detected at ${address}`)

          await recordDeposit({
            chainId:     TON_CHAIN_ID,
            address,
            amount:      delta,
            txHash:      '',     // no txHash from simple balance check
            blockNumber: 0,      // supply if you can
          })

          // bump on-chain record
          await prisma.depositAddress.update({
            where: { address },
            data:  { lastBalance: balance.toString() },
          })

          cache[address] = balance
        }
      } catch (err) {
        console.error('❌ TON error for', address, err)
      }
    }
  }, POLL_INTERVAL_MS)
}

// allow `node src/services/tonDepositMonitor.ts` → run monitor standalone
if (require.main === module) {
  startTonDepositMonitor().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
