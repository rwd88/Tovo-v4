import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface DepositAddress {
  id: number;
  chainId: number;
  address: string;
  lastBalance: string;
}

/**
 * Create a new on-chain deposit record and update address balance.
 */
export async function recordDeposit(data: {
  chainId: number;
  address: string;
  amount: string;
  txHash: string;
  blockNumber: number;
}): Promise<import('@prisma/client').Deposit> {
  // 1) insert deposit
  const deposit = await prisma.deposit.create({
    data: {
      chainId:     data.chainId,
      address:     data.address,
      amount:      data.amount,
      txHash:      data.txHash,
      blockNumber: data.blockNumber,
    },
  });

  // 2) update lastBalance on DepositAddress
  const addr = await prisma.depositAddress.findUnique({
    where: { address: data.address },
    select: { lastBalance: true },
  });

  if (addr) {
    const oldBal = BigInt(addr.lastBalance);
    const delta  = BigInt(data.amount);
    const newBal = (oldBal + delta).toString();

    await prisma.depositAddress.update({
      where: { address: data.address },
      data:  { lastBalance: newBal },
    });
  }

  return deposit;
}
