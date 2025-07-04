// src/services/tonDepositMonitor.ts

import TonWeb from 'tonweb'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Load env vars
const TON_RPC_URL = process.env.TON_RPC_URL!
const TON_CHAIN_ID = Number(process.env.TON_CHAIN_ID || '102')
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || '15000')

if (!TON_RPC_URL) {
  throw new Error('Missing TON_RPC_URL in .env.local')
}

const tonweb = new TonWeb(new TonWeb.HttpProvider(TON_RPC_URL))
const lastBalances: Record<string, bigint> = {}

export async function startTonDepositMonitor() {
  console.log('Starting TON deposit monitor on', TON_RPC_URL)

  // 1) load all deposit addresses
  const addresses = await prisma.depositAddress.findMany({
    where: { chainId: TON_CHAIN_ID },
    select: { address: true, lastBalance: true },
  })

  // 2) seed in-memory state
  for (const { address, lastBalance } of addresses) {
    lastBalances[address] = BigInt(lastBalance)
  }

  // 3) poll loop
  setInterval(async () => {
    for (const { address } of addresses) {
      try {
        const balanceStr = await tonweb.getBalance(address)
        const balance = BigInt(balanceStr)
        const prev = lastBalances[address] ?? 0n

        if (balance > prev) {
          const delta = balance - prev
          console.log(`❤️‍🔥 Detected TON deposit of ${delta} to ${address}`)

          // record in deposits table
          await prisma.deposit.create({
            data: {
              chainId: TON_CHAIN_ID,
              address,
              amount: delta.toString(),
              txHash: '',        // no txHash from balance query
              blockNumber: 0,    // unknown
            },
          })

          // update the on-chain address record
          await prisma.depositAddress.update({
            where: { address },
            data: { lastBalance: balance.toString() },
          })

          // update our in-memory cache
          lastBalances[address] = balance
        }
      } catch (e) {
        console.error('TON monitor error for', address, e)
      }
    }
  }, POLL_INTERVAL_MS)

  console.log('TON deposit monitor started')
}

// if you ever run this file directly:
if (require.main === module) {
  startTonDepositMonitor().catch(e => {
    console.error(e)
    process.exit(1)
  })
}
