import * as dotenv from "dotenv"; dotenv.config();
import hre from "hardhat";
import { ethers } from "ethers";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";

function getNet(): string {
  const idx = process.argv.findIndex(a => a === "--network" || a === "-n");
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1].toLowerCase();
  return (hre.network?.name || "sepolia").toLowerCase(); // default to sepolia
}

async function main() {
  const net = getNet();
  console.log("Network:", net);

  // choose the first artifact that exists
  const candidates = ["PredictionMarket", "Counter", "Lock"];
  let name = "", art: any;
  for (const n of candidates) { try { art = await hre.artifacts.readArtifact(n); name = n; break; } catch {} }
  if (!name) throw new Error("No artifact found. Run `npx hardhat compile`.");

  const url = process.env.SEPOLIA_RPC_URL!;
  const pk  = process.env.SEPOLIA_PRIVATE_KEY!;
  if (!url) throw new Error("SEPOLIA_RPC_URL missing");
  if (!pk?.startsWith("0x")) throw new Error("SEPOLIA_PRIVATE_KEY must start with 0x");

  const provider = new ethers.JsonRpcProvider(url);
  const wallet   = new ethers.Wallet(pk, provider);

  console.log(`Deployer: ${wallet.address}`);
  const factory  = new ethers.ContractFactory(art.abi, art.bytecode, wallet);
  const contract = await factory.deploy();
  await contract.deploymentTransaction()?.wait();
  const address  = await contract.getAddress();
  console.log(`✅ Deployed ${name} at ${address}`);

  const outDir = path.resolve(process.cwd(), "../contracts-out");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, `${name}.${net}.json`), JSON.stringify({ address, abi: art.abi }, null, 2));
  console.log("📝 Wrote contracts-out file");
}
main().catch(e => { console.error(e); process.exit(1); });
