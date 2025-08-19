// pages/api/chain/health.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getPublicProvider } from "@/lib/provider";
import { CONTRACT_ADDRESS } from "@/lib/contracts";
import { ethers } from "ethers";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const provider = getPublicProvider();
    const [network, block, code] = await Promise.all([
      provider.getNetwork(),
      provider.getBlockNumber(),
      provider.getCode(CONTRACT_ADDRESS),
    ]);

    res.status(200).json({
      network: network.name,
      chainId: Number(network.chainId),
      blockNumber: block,
      contractDeployed: code && code !== "0x",
      contractAddress: CONTRACT_ADDRESS,
      codeSize: code?.length ?? 0
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "unknown error" });
  }
}
