// components/WalletDrawer.tsx
const XIcon = () => <span className="text-xl">×</span>
import ConnectWalletButton from './ConnectWalletButton'

type Props = {
  open: boolean
  onClose: () => void
}

export default function WalletDrawer({ open, onClose }: Props) {
  return (
    <div
      className={`fixed top-0 right-0 h-full w-80 max-w-[90%] bg-[#1C1F2A] text-white p-6 z-50 transform transition-transform duration-300 ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold">Connect Wallet</h2>
  <button id="wallet-drawer-close" onClick={onClose}>
<XIcon />
        </button>
      </div>
      <ConnectWalletButton />
    </div>
  )
}
