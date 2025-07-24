// components/ConnectWalletButton.tsx
import React, { useState } from 'react';
import { useEthereum } from '../../contexts/EthereumContext';
import { useSolana } from '../../contexts/SolanaContext';
import { useTon } from '<div styleName={} />../../../contexts/TonContext';

export const ConnectWalletButton = () => {
  const [activeChain, setActiveChain] = useState<'ethereum' | 'solana' | 'ton'>('ethereum');
  const [isConnecting, setIsConnecting] = useState(false);
  
  const { address: ethAddress, connect: connectEth, disconnect: disconnectEth } = useEthereum();
  const { publicKey: solAddress, connect: connectSol, disconnect: disconnectSol } = useSolana();
  const { address: tonAddress, connect: connectTon, disconnect: disconnectTon } = useTon();

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      if (activeChain === 'ethereum') await connectEth();
      if (activeChain === 'solana') await connectSol();
      if (activeChain === 'ton') await connectTon();
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (activeChain === 'ethereum') await disconnectEth();
    if (activeChain === 'solana') await disconnectSol();
    if (activeChain === 'ton') await disconnectTon();
  };

  const currentAddress = 
    activeChain === 'ethereum' ? ethAddress :
    activeChain === 'solana' ? solAddress?.toString() :
    tonAddress;

  return (
    <div className="wallet-connector">
      <div className="chain-selector">
        <button 
          className={activeChain === 'ethereum' ? 'active' : ''}
          onClick={() => setActiveChain('ethereum')}
        >
          Ethereum
        </button>
        <button
          className={activeChain === 'solana' ? 'active' : ''}
          onClick={() => setActiveChain('solana')}
        >
          Solana
        </button>
        <button
          className={activeChain === 'ton' ? 'active' : ''}
          onClick={() => setActiveChain('ton')}
        >
          TON
        </button>
      </div>
      
      {currentAddress ? (
        <button className="connected-btn" onClick={handleDisconnect}>
          {`${currentAddress.slice(0, 6)}...${currentAddress.slice(-4)}`}
        </button>
      ) : (
        <button 
          className="connect-btn" 
          onClick={handleConnect}
          disabled={isConnecting}
        >
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      )}
    </div>
  );
};