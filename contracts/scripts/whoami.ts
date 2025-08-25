import * as dotenv from "dotenv"; dotenv.config();
import { ethers } from "ethers";
(async () => {
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL!);
  const wallet   = new ethers.Wallet(process.env.SEPOLIA_PRIVATE_KEY!, provider);
  const bal      = await provider.getBalance(wallet.address);
  console.log({ network: await provider.getNetwork(), address: wallet.address, balance: ethers.formatEther(bal) });
})();
