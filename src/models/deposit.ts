import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface DepositAddress {
  id: number;
  chainId: number;
  address: string;
  lastBalance: string;
}

export async function recordDeposit(data: {
  chainId: number;
  address: string;
  amount: string;
  txHash: string;
  blockNumber: number;
}): Promise<import('@prisma/client').Deposit> {
  const deposit = await prisma.onChainDeposit.create({
    data: {
      chainId: data.chainId,
      address: data.address,
      amount: data.amount,
      txHash: data.txHash,
      blockNumber: data.blockNumber,
    },
  });

  const addrRec = await prisma.depositAddress.findUnique({
    where: { address: data.address },
    select: { lastBalance: true },
  });

  if (addrRec) {
    const oldBal = BigInt(addrRec.lastBalance);
    const delta  = BigInt(data.amount);
    await prisma.depositAddress.update({
      where: { address: data.address },
      data: { lastBalance: (oldBal + delta).toString() },
    });
  }

  return deposit;
}