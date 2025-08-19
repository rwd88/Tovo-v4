import * as dotenv from "dotenv"; dotenv.config();
import hre from "hardhat";
import { ethers } from "ethers";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";

function getNet(): string {
  const idx = process.argv.findIndex(a => a === "--network" || a === "-n");
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1].toLowerCase();
  if ((hre as any).network?.name) return String((hre as any).network.name).toLowerCase();
  if (process.env.HARDHAT_NETWORK) return process.env.HARDHAT_NETWORK.toLowerCase();
  throw new Error("No network selected. Use --network <name>.");
}

function netVars(net: string) {
  if (net === "mainnet" || net === "homestead")
    return { url: process.env.MAINNET_RPC_URL!, pk: process.env.MAINNET_PRIVATE_KEY! };
  if (net === "sepolia")
    return { url: process.env.SEPOLIA_RPC_URL!, pk: process.env.SEPOLIA_PRIVATE_KEY! };
  if (net === "localhost")
    return { url: "http://127.0.0.1:8545", pk: process.env.LOCAL_PRIVATE_KEY ?? "" };
  throw new Error(`Unsupported network: ${net}`);
}

async function main() {
  const net = getNet();
  console.log("Network:", net);

  // pick the first artifact that exists (change list to your contract)
  const candidates = ["PredictionMarket", "Counter", "Lock"];
  let name = "", art: any;
  for (const n of candidates) { try { art = await hre.artifacts.readArtifact(n); name = n; break; } catch {} }
  if (!name) throw new Error("No artifact found. Run `npx hardhat compile`.");

  const { url, pk } = netVars(net);
  if (!url) throw new Error("RPC URL missing");
  if (!pk?.startsWith("0x")) throw new Error("Private key missing or not 0x-prefixed");

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
  const outPath = path.join(outDir, `${name}.${net}.json`);
  writeFileSync(outPath, JSON.stringify({ address, abi: art.abi }, null, 2));
  console.log(`📝 Wrote ${outPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
