import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Represents a deposit address record
export interface DepositAddress {
  id: number;
  chainId: number;
  address: string;
  lastBalance: string; // stored as string for consistency
}

// Fetch all deposit addresses for a given chain
export async function getDepositAddresses(chainId: number): Promise<DepositAddress[]> {
  return prisma.depositAddress.findMany({
    where: { chainId },
    select: { id: true, chainId: true, address: true, lastBalance: true },
  });
}

// Record a new deposit
export async function recordDeposit(data: {
  chainId: number;
  address: string;
  amount: string;
  txHash: string;
  blockNumber: number;
}): Promise<void> {
  await prisma.deposit.create({
    data: {
      chainId: data.chainId,
      address: data.address,
      amount: data.amount,
      txHash: data.txHash,
      blockNumber: data.blockNumber,
    },
  });

  // Update lastBalance on the deposit address
  await prisma.depositAddress.updateMany({
    where: {
      chainId: data.chainId,
      address: data.address,
    },
    data: {
      lastBalance: (Number(data.amount) + Number((await prisma.depositAddress.findUnique({ where: { id: (await prisma.depositAddress.findFirst({ where: { chainId: data.chainId, address: data.address } })).id } })).lastBalance)).toString(),
    },
  });
}
