import { useState, useEffect, useCallback } from "react";
import type { BrowserProvider } from "ethers";
import {
  connectWallet,
  disconnectWallet,
  getEthersProvider,
  getAddress,
  getChainId,
} from "../services/wallet";

export function useWallet() {
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const init = useCallback(async () => {
    const existing = getEthersProvider();
    if (existing) {
      setProvider(existing);
      const addr = await getAddress();
      const id = await getChainId();
      setAddress(addr);
      setChainId(id);
      setIsConnected(true);
    }
  }, []);

  const connect = useCallback(async () => {
    try {
      const ethersProvider = await connectWallet();
      setProvider(ethersProvider);
      const signer = await ethersProvider.getSigner();
      const addr = await signer.getAddress();
      const id = (await ethersProvider.getNetwork()).chainId;
      setAddress(addr);
      setChainId(id);
      setIsConnected(true);
    } catch (err) {
      console.error("Wallet connection failed", err);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await disconnectWallet();
    setProvider(null);
    setAddress(null);
    setChainId(null);
    setIsConnected(false);
  }, []);

  useEffect(() => {
    init();
  }, [init]);

  return { provider, address, chainId, isConnected, connect, disconnect };
}
