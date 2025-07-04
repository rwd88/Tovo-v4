// src/services/tonDepositMonitor.ts

import TonWeb from 'tonweb'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// load env
const TON_RPC_URL      = process.env.TON_RPC_URL!
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS!  || '15000', 10)

if (!TON_RPC_URL) throw new Error('Missing TON_RPC_URL in .env.local')

const tonweb = new TonWeb(new TonWeb.HttpProvider(TON_RPC_URL))
const cache: Record<string, bigint> = {}

export async function startTonDepositMonitor() {
  console.log('☑️  TON monitor starting—polling every', POLL_INTERVAL_MS, 'ms')

  // pull all known deposit‐addresses
  const addrs = await prisma.depositAddress.findMany({
    where: { network: 'TON' },      // assumes you tagged them with network: 'TON'
    select: { address: true, lastBalance: true },
  })

  // seed our cache
  for (const { address, lastBalance } of addrs) {
    cache[address] = BigInt(lastBalance)
  }

  setInterval(async () => {
    for (const { address } of addrs) {
      try {
        const balance = BigInt(await tonweb.getBalance(address))
        const prev    = cache[address] || 0n

        if (balance > prev) {
          const delta = balance - prev
          console.log(`🔔 TON deposit ${delta} detected at ${address}`)

          // write to your onChainDeposit table
          await prisma.onChainDeposit.create({
            data: {
              network: 'TON',
              txHash:  '',        // unavailable from balance query
              status:  'pending', // or whatever you prefer
            },
          })

          // bump the depositAddress lastBalance
          await prisma.depositAddress.update({
            where: { address },
            data: { lastBalance: balance.toString() },
          })

          // update in‐mem
          cache[address] = balance
        }
      } catch (e) {
        console.error('❌ TON error for', address, e)
      }
    }
  }, POLL_INTERVAL_MS)
}

// allow standalone run
if (require.main === module) {
  startTonDepositMonitor().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
