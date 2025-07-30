import { useEffect, useState } from 'react'
import ConnectWalletButton from './ConnectWalletButton'
import Image from 'next/image'

type Props = {
  open: boolean
  onClose: () => void
}

export default function WalletDrawer({ open, onClose }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) setVisible(true)
    else {
      const timeout = setTimeout(() => setVisible(false), 300)
      return () => clearTimeout(timeout)
    }
  }, [open])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50">
      {/* Drawer panel */}
      <div
        className={`fixed top-0 left-0 h-full w-[90%] max-w-sm bg-[#003E37] text-white p-6 rounded-r-2xl shadow-lg transform transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header with avatar and close */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Tovo Logo" width={50} height={30} />
            <div>
              <h3 className="text-lg font-semibold">Connect Wallet</h3>
              <p className="text-sm text-gray-300">Choose your network</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-white text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Body content */}
        <div className="space-y-4 mt-6">
          <ConnectWalletButton />
        </div>
      </div>
    </div>
  )
}
