import { useEffect, useState } from 'react'
import ConnectWalletButton from './ConnectWalletButton'
import Image from 'next/image'

type Props = {
  open: boolean
  onClose: () => void
}

export default function WalletDrawer({ open, onClose }: Props) {
  const [visible, setVisible] = useState(false)
  const [animatingOut, setAnimatingOut] = useState(false)

  useEffect(() => {
    if (open) {
      setVisible(true)
      setAnimatingOut(false)
    } else {
      setAnimatingOut(true)
      const timeout = setTimeout(() => {
        setVisible(false)
        setAnimatingOut(false)
      }, 300) // match animation duration
      return () => clearTimeout(timeout)
    }
  }, [open])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black bg-opacity-60">
        <div
  className={`bg-[#003E37] text-white w-[90%] h-full max-w-[400px] p-6 shadow-xl relative overflow-y-auto rounded-l-2xl ${
    animatingOut ? 'drawer-close' : 'drawer-open'
  }`}
>
        {/* Close Button */}
        <button
          id="wallet-drawer-close"
          onClick={onClose}
          className="absolute top-4 right-4 text-white text-2xl font-bold"
        >
          ×
        </button>

        {/* Logo */}
        <div className="flex items-center gap-3 mb-6">
          <Image src="/logo.png" alt="Logo" width={50} height={30} />
          <div>
            <h3 className="text-lg font-semibold">Connect Wallet</h3>
            <p className="text-sm text-gray-300">Choose your network</p>
          </div>
        </div>

        {/* Wallet Buttons */}
        <div className="space-y-4 mt-6">
          <ConnectWalletButton />
        </div>
      </div>
    </div>
  )
}
