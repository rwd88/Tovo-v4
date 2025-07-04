import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export interface RecordDepositInput {
  chainId:    number
  address:    string
  amount:     string
  txHash:     string
  blockNumber: number
}

export async function recordDeposit(data: RecordDepositInput) {
  // 1) insert into `deposit`
  const deposit = await prisma.deposit.create({
    data: {
      chainId:     data.chainId,
      address:     data.address,
      amount:      data.amount,
      txHash:      data.txHash,
      blockNumber: data.blockNumber,
    },
  })

  // 2) bump the matching DepositAddress.lastBalance
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
