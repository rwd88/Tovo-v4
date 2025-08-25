// src/models/deposit.ts
import prisma from '../../lib/prisma'

export interface DepositAddress {
  address:    string
  lastBalance: string
}

// Fetch all deposit‐addresses for a given chain
export async function getDepositAddresses(chainId: number): Promise<DepositAddress[]> {
  return prisma.depositAddress.findMany({
    where:  { chainId },
    select: { address: true, lastBalance: true }
  })
}

export interface RecordDepositInput {
  chainId:     number
  address:     string
  amount:      string
  txHash:      string
  blockNumber: number
}

// Insert a deposit row and bump the lastBalance on the depositAddress
export async function recordDeposit(data: RecordDepositInput) {
  // 1) insert into your deposit table
  const deposit = await prisma.deposit.create({
    data: {
      chainId:     data.chainId,
      address:     data.address,
      amount:      data.amount,
      txHash:      data.txHash,
      blockNumber: data.blockNumber,
    },
  })

  // 2) read current balance
  const addr = await prisma.depositAddress.findUnique({
    where:  { address: data.address },
    select: { lastBalance: true },
  })

  if (addr) {
    const newBalance = (BigInt(addr.lastBalance) + BigInt(data.amount)).toString()
    await prisma.depositAddress.update({
      where: { address: data.address },
      data:  { lastBalance: newBalance },
    })
  }

  return deposit
}
