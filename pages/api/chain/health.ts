import type { NextApiRequest, NextApiResponse } from "next";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../../../src/lib/contracts";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const rpcUrl = process.env.EVM_RPC_URL!;
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();

    let codeSize = 0;
    let contractDeployed = false;
    try {
      const code = await provider.getCode(CONTRACT_ADDRESS);
      codeSize = code.length;
      contractDeployed = codeSize > 2;
    } catch (e) {
      console.error("getCode failed", e);
    }

    return res.status(200).json({
      network: network.name,
      chainId: Number(network.chainId),
      blockNumber,
      contractAddress: CONTRACT_ADDRESS,
      contractDeployed,
      codeSize,
    });
  } catch (err: any) {
    console.error("❌ health.ts failed", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
