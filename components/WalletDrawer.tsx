// components/WalletDrawer.tsx
'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import ConnectWalletButton from './ConnectWalletButton'

type Props = {
  open: boolean
  onClose: () => void
}

export default function WalletDrawer({ open, onClose }: Props) {
  const [visible, setVisible] = useState(open)

  // keep mounted for animation
  useEffect(() => {
    if (open) setVisible(true)
    else {
      // after animation, unmount
      const t = setTimeout(() => setVisible(false), 300)
      return () => clearTimeout(t)
    }
  }, [open])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-60"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-[90%] max-w-[400px] 
                    bg-[#003E37] text-white p-6 overflow-y-auto 
                    transform transition-transform duration-300`}
        style={{
          transform: open
            ? 'translateX(0)'     // slide in
            : 'translateX(100%)', // slide out to the right
          zIndex: 51,
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white text-3xl"
        >
          ×
        </button>

        {/* Logo + title */}
        <div className="flex items-center gap-3 mb-6">
          <Image src="/logo.png" alt="Logo" width={50} height={30} style={{ objectFit: 'contain' }} />
          <div>
            <h3 className="text-lg font-semibold">Connect Wallet</h3>
            <p className="text-sm text-gray-300">Choose your network</p>
          </div>
        </div>  

        {/* Wallet buttons */}
        <div className="space-y-4">
          <ConnectWalletButton />
        </div>
      </div>
    </div>
  )
}
