import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Represents a deposit address record
export interface DepositAddress {
  id: number;
  chainId: number;
  address: string;
  lastBalance: string; // stored as string for consistency (Wei)
}

// Fetch all deposit addresses for a given chain
export async function getDepositAddresses(chainId: number): Promise<DepositAddress[]> {
  return prisma.depositAddress.findMany({
    where: { chainId },
    select: { id: true, chainId: true, address: true, lastBalance: true },
  });
}

// Record a new on-chain deposit
export async function recordDeposit(data: {
  chainId: number;
  address: string;
  amount: string;      // amount in Wei as string
  txHash: string;
  blockNumber: number;
}): Promise<void> {
  // 1. Insert the on-chain deposit record
  await prisma.onChainDeposit.create({
    data: {
      chainId: data.chainId,
      address:  data.address,
      amount:   data.amount,
      txHash:   data.txHash,
      blockNumber: data.blockNumber,
    },
  });

  // 2. Update lastBalance on the deposit address
  const addrRecord = await prisma.depositAddress.findUnique({
    where: { address: data.address },
    select: { lastBalance: true },
  });

  if (addrRecord) {
    const oldBal = BigInt(addrRecord.lastBalance);
    const depositAmt = BigInt(data.amount);
    const newBal = (oldBal + depositAmt).toString();

    await prisma.depositAddress.update({
      where: { address: data.address },
      data: { lastBalance: newBal },
    });
  }
}
