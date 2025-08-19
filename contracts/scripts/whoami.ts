import * as dotenv from "dotenv";
dotenv.config();

import { ethers } from "ethers";

async function main() {
  const rpc = process.env.SEPOLIA_RPC_URL!;
  const pk  = process.env.SEPOLIA_PRIVATE_KEY!;
  if (!rpc) throw new Error("SEPOLIA_RPC_URL missing");
  if (!pk?.startsWith("0x")) throw new Error("SEPOLIA_PRIVATE_KEY must start with 0x");

  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet   = new ethers.Wallet(pk, provider);

  const [net, bal] = await Promise.all([
    provider.getNetwork(),
    provider.getBalance(wallet.address),
  ]);

  console.log("Network:", net.name, Number(net.chainId));
  console.log("Deployer:", wallet.address);
  console.log("Balance (ETH):", ethers.formatEther(bal));
}

main().catch((e) => { console.error(e); process.exit(1); });
