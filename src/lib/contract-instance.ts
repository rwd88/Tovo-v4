// src/lib/contract-instance.ts
import { ethers } from "ethers";
import { getPublicProvider } from "./provider";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./contracts";

// Read-only contract via RPC
export function getReadContract() {
  const provider = getPublicProvider();
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
}

// Read–write (requires wallet)
export async function getWriteContract() {
  const { getBrowserSigner } = await import("./provider");
  const { signer } = await getBrowserSigner();
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
}
