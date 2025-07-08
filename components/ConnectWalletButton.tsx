// components/ConnectWalletButton.tsx

import { useEthereum } from "../contexts/EthereumContext"
import dynamic from "next/dynamic"
import { TonConnectButton } from "@tonconnect/ui-react"

const SolanaWalletMultiButton = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
)

export default function ConnectWalletButton() {
  const { connect, disconnect, address } = useEthereum()

  return (
    <div className="flex flex-col gap-4">
      {/* EVM: MetaMask / Web3Modal */}
      <button
        onClick={address ? disconnect : connect}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        {address ? `Disconnect: ${address.slice(0, 6)}...` : "Connect Wallet"}
      </button>

      {/* TON Connect */}
      <TonConnectButton />

      {/* Solana Wallet Adapter */}
      <SolanaWalletMultiButton />
    </div>
  )
}
