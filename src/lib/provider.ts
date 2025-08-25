import { ethers } from "ethers";
export function getPublicProvider() {
  const url = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SEPOLIA_RPC_URL missing");
  return new ethers.JsonRpcProvider(url);
}
export async function getBrowserSigner() {
  if (typeof window === "undefined") throw new Error("No window");
  // @ts-ignore
  const { ethereum } = window;
  if (!ethereum) throw new Error("No injected wallet");
  const provider = new ethers.BrowserProvider(ethereum);
  await provider.send("wallet_switchEthereumChain", [{ chainId: "0xaa36a7" }]).catch(() => {});
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  return { signer, provider };
}
