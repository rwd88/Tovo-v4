import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface DepositAddress {
  id: number;
  chainId: number;
  address: string;
  lastBalance: string;
}

export interface OnChainDeposit {
  id: string;
  chainId: number;
  address: string;
  amount: string;
  txHash: string;
  blockNumber: number;
  createdAt: Date;
}

export async function getDepositAddresses(chainId: number): Promise<DepositAddress[]> {
  return prisma.depositAddress.findMany({
    where: { chainId },
    select: { id: true, chainId: true, address: true, lastBalance: true },
  });
}

export async function recordDeposit(data: {
  chainId: number;
  address: string;
  amount: string;
  txHash: string;
  blockNumber: number;
}): Promise<OnChainDeposit> {
  // 1. Create new on-chain deposit record
  const deposit = await prisma.onChainDeposit.create({
    data: {
      chainId:    data.chainId,
      address:    data.address,
      amount:     data.amount,
      txHash:     data.txHash,
      blockNumber: data.blockNumber,
    },
  });

  // 2. Update lastBalance on the deposit address
  const addrRecord = await prisma.depositAddress.findUnique({
    where: { address: data.address },
    select: { lastBalance: true },
  });

  if (addrRecord) {
    const oldBal    = BigInt(addrRecord.lastBalance);
    const depositAmt = BigInt(data.amount);
    const newBal    = (oldBal + depositAmt).toString();

    await prisma.depositAddress.update({
      where: { address: data.address },
      data:  { lastBalance: newBal },
    });
  }

  return deposit;
}