import React from 'react';
import { useWallet } from '../hooks/useWallet';

// Utility to truncate an Ethereum address
const truncateAddress = (address: string): string =>
  `${address.slice(0, 6)}...${address.slice(-4)}`;

// Supported chain IDs (add your networks here)
const SUPPORTED_CHAINS = [1, 56, 137];

export const ConnectWalletButton: React.FC = () => {
  const { address, chainId, isConnected, connect, disconnect } = useWallet();

  const handleConnect = () => {
    connect();
  };

  const handleDisconnect = () => {
    disconnect();
  };

  // If connected but on unsupported chain
  if (isConnected && chainId && !SUPPORTED_CHAINS.includes(chainId)) {
    return (
      <button
        onClick={handleDisconnect}
        className="px-4 py-2 bg-red-500 text-white rounded"
      >
        Wrong network (chain {chainId}). Disconnect
      </button>
    );
  }

  return isConnected ? (
    <div className="flex items-center space-x-2">
      <span className="font-mono">{truncateAddress(address!)}</span>
      <button
        onClick={handleDisconnect}
        className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
      >
        Disconnect
      </button>
    </div>
  ) : (
    <button
      onClick={handleConnect}
      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
    >
      Connect Wallet
    </button>
  );
};
