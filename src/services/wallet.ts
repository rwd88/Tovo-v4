import Web3Modal from "web3modal";
import { BrowserProvider, JsonRpcSigner } from "ethers";
import WalletConnectProvider from "@walletconnect/web3-provider";

// RPC URLs for EVM chains
const RPC: Record<number, string> = {
  1: process.env.REACT_APP_ETH_RPC_URL || "https://mainnet.infura.io/v3/YOUR_INFURA_ID",
  56: process.env.REACT_APP_BSC_RPC_URL || "https://bsc-dataseed.binance.org/",
  // add other EVM chain RPCs as needed
};

// Web3Modal provider options
const providerOptions = {
  injected: {
    package: null,
  },
  walletconnect: {
    package: WalletConnectProvider,
    options: {
      rpc: RPC,
      qrcode: true,
    },
  },
  // TODO: add custom TronLink provider for TRC-20
};

// Singleton Web3Modal instance
let web3Modal: Web3Modal;
let cachedProvider: any = null;

function initWeb3Modal(): Web3Modal {
  if (!web3Modal) {
    web3Modal = new Web3Modal({
      cacheProvider: true,
      providerOptions,
    });
  }
  return web3Modal;
}

// Connect wallet
export async function connectWallet(): Promise<BrowserProvider> {
  const modal = initWeb3Modal();
  // The raw provider supports event subscriptions but isn't typed by ethers
  const externalProviderRaw = await modal.connect();
  const externalProvider: any = externalProviderRaw;
  cachedProvider = externalProvider;
  const ethersProvider = new BrowserProvider(externalProvider);

  // Subscribe to provider events
  externalProvider.on("accountsChanged", () => window.location.reload());
  externalProvider.on("chainChanged", () => window.location.reload());
  externalProvider.on("disconnect", () => disconnectWallet());

  return ethersProvider;
}

// Disconnect wallet
export async function disconnectWallet(): Promise<void> {
  initWeb3Modal().clearCachedProvider();
  if (cachedProvider && typeof cachedProvider.disconnect === "function") {
    await cachedProvider.disconnect();
  }
  cachedProvider = null;
  window.location.reload();
}

// Get ethers.js provider
export function getEthersProvider(): BrowserProvider | null {
  if (!cachedProvider) return null;
  return new BrowserProvider(cachedProvider);
}

// Helpers
export async function getSigner(): Promise<JsonRpcSigner | null> {
  const provider = getEthersProvider();
  return provider ? await provider.getSigner() : null;
}

export async function getAddress(): Promise<string | null> {
  const signer = await getSigner();
  return signer ? await signer.getAddress() : null;
}

export async function getChainId(): Promise<number | null> {
  const provider = getEthersProvider();
  if (!provider) return null;
  const network = await provider.getNetwork();
  return Number(network.chainId);
}
