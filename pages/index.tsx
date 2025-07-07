import Head from "next/head"
import Image from "next/image"
import { Geist, Geist_Mono } from "next/font/google"
import styles from "../styles/Home.module.css"

import { useEthereum } from "../contexts/EthereumContext"
import ConnectWalletButton from "../components/ConnectWalletButton"
import TradeForm from "../components/TradeForm"
import { useTokenBalance } from "../hooks/useTokenBalance"
import { useEffect, useState } from "react"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export default function Home() {
  const [isClient, setIsClient] = useState(false)
  const { address } = useEthereum()

  useEffect(() => {
    setIsClient(true)
  }, [])

  const USDT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
  const USDC_ADDRESS = "0xA0b86991C6218B36c1d19D4a2e9Eb0cE3606EB48"

  // Only fetch balances client-side
  const usdtBalance = isClient ? useTokenBalance(USDT_ADDRESS) : null
  const usdcBalance = isClient ? useTokenBalance(USDC_ADDRESS) : null

  if (!isClient) return null // prevent SSR crash

  return (
    <>
      <Head>
        <title>Tovo Bot Dashboard</title>
        <meta name="description" content="Tovo prediction market dashboard" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className={`${styles.page} ${geistSans.variable} ${geistMono.variable}`}>
        <main className={styles.main}>
          {/* Wallet Connect */}
          <div className="mb-6">
            <ConnectWalletButton />
          </div>

          {/* Show balances */}
          {address && (
            <div className="mb-6">
              <p>USDT Balance: {usdtBalance}</p>
              <p>USDC Balance: {usdcBalance}</p>
            </div>
          )}

          {/* Trade form */}
          {address && (
            <div className="mb-8">
              <TradeForm />
            </div>
          )}

          <Image
            className={styles.logo}
            src="/next.svg"
            alt="Next.js logo"
            width={180}
            height={38}
            priority
          />

          <ol className="mt-4">
            <li>Get started by editing <code>pages/index.tsx</code>.</li>
            <li>Save and see your changes instantly.</li>
          </ol>

          <div className={styles.ctas}>
            <a className={styles.primary} href="https://vercel.com/new" target="_blank" rel="noopener noreferrer">
              <Image src="/vercel.svg" alt="Vercel" width={20} height={20} />
              Deploy now
            </a>
            <a className={styles.secondary} href="https://nextjs.org/docs" target="_blank" rel="noopener noreferrer">
              Read our docs
            </a>
          </div>
        </main>

        <footer className={styles.footer}>
          <a href="https://nextjs.org/learn" target="_blank" rel="noopener noreferrer">
            <Image src="/file.svg" alt="File" width={16} height={16} />
            Learn
          </a>
          <a href="https://vercel.com/templates" target="_blank" rel="noopener noreferrer">
            <Image src="/window.svg" alt="Window" width={16} height={16} />
            Examples
          </a>
          <a href="https://nextjs.org" target="_blank" rel="noopener noreferrer">
            <Image src="/globe.svg" alt="Globe" width={16} height={16} />
            Go to nextjs.org →
          </a>
        </footer>
      </div>
    </>
  )
}
