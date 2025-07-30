import { useEffect, useState } from 'react'
import ConnectWalletButton from './ConnectWalletButton'

type Props = {
  open: boolean
  onClose: () => void
}

export default function WalletDrawer({ open, onClose }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) setVisible(true)
    else {
      // Add delay for slide-out animation
      const timeout = setTimeout(() => setVisible(false), 300)
      return () => clearTimeout(timeout)
    }
  }, [open])

  if (!visible) return null

  return (
    <div
      className={`fixed inset-0 z-50 bg-[#1C1F2A] text-white p-6 transition-transform duration-300 ease-in-out transform ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="flex justify-between items-center mb-6">
        {open && <h2 className="text-lg font-semibold">Connect Wallet</h2>}
        <button id="wallet-drawer-close" onClick={onClose}>
          <span className="text-xl">×</span>
        </button>
      </div>

      {open && <ConnectWalletButton />}
    </div>
  )
}
