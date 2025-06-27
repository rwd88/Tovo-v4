// lib/wallet.ts
import Web3Modal from "web3modal";
import { ethers } from "ethers";
import WalletConnectProvider from "@walletconnect/web3-provider";
import TronWeb from "tronweb";

export async function connectEVM() {
  const modal = new Web3Modal({
    cacheProvider: true,
    providerOptions: {
      walletconnect: {
        package: WalletConnectProvider,
        options: {
          rpc: {
            1: process.env.NEXT_PUBLIC_ETH_RPC,      // Ethereum RPC URL
            56: process.env.NEXT_PUBLIC_BSC_RPC      // BSC RPC URL
          },
        },
      },
    }
  });
  const provider = await modal.connect();
  return new ethers.providers.Web3Provider(provider);
}

export async function connectTron() {
  const provider = await (window as any).tronLink?.request({ method: "tron_requestAccounts" });
  if (!provider) throw new Error("TronLink not installed");
  return new TronWeb({
    fullHost: process.env.NEXT_PUBLIC_TRON_RPC!,
    privateKey: "" // walletLink doesn’t expose privateKey; signing handled by tronLink
  });
}
