import { useState, useEffect, useCallback } from "react";
import type { Web3Provider } from "@ethersproject/providers";
import {
  connectWallet,
  disconnectWallet,
  getEthersProvider,
  getAddress,
  getChainId,
} from "../services/wallet";

export function useWallet() {
  const [provider, setProvider] = useState<Web3Provider | null>(null);
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
      const addr = await ethersProvider.getSigner().getAddress();
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
    // no event subscriptions here, handled in wallet.ts
  }, [init]);

  return { provider, address, chainId, isConnected, connect, disconnect };
}
