import Web3Modal from "web3modal";
import { providers } from "ethers";
import WalletConnectProvider from "@walletconnect/web3-provider";

// RPC URLs for EVM chains
const RPC: { [chainId: number]: string } = {
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
      // Example: bridge server if needed
      // bridge: "https://bridge.walletconnect.org",
      qrcode: true,
    },
  },
  // TODO: add custom TronLink provider for TRC-20
};

// Singleton Web3Modal instance
let web3Modal: Web3Modal;
let cachedProvider: any;

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
export async function connectWallet(): Promise<providers.Web3Provider> {
  const modal = initWeb3Modal();
  const provider = await modal.connect();
  cachedProvider = provider;
  const ethersProvider = new providers.Web3Provider(provider);

  // Subscribe to provider events
  provider.on("accountsChanged", (accounts: string[]) => {
    window.location.reload(); // or update state
  });
  provider.on("chainChanged", () => {
    window.location.reload();
  });
  provider.on("disconnect", () => {
    disconnectWallet();
  });

  return ethersProvider;
}

// Disconnect wallet
export async function disconnectWallet(): Promise<void> {
  const modal = initWeb3Modal();
  await modal.clearCachedProvider();
  if (cachedProvider?.disconnect && typeof cachedProvider.disconnect === "function") {
    await cachedProvider.disconnect();
  }
  cachedProvider = null;
  window.location.reload();
}

// Get ethers.js provider
export function getEthersProvider(): providers.Web3Provider | null {
  if (!cachedProvider) return null;
  return new providers.Web3Provider(cachedProvider);
}

// Helpers
export async function getSigner(): Promise<providers.JsonRpcSigner | null> {
  const provider = getEthersProvider();
  return provider ? provider.getSigner() : null;
}

export async function getAddress(): Promise<string | null> {
  const signer = await getSigner();
  return signer ? signer.getAddress() : null;
}

export async function getChainId(): Promise<number | null> {
  const provider = getEthersProvider();
  return provider ? (await provider.getNetwork()).chainId : null;
}
