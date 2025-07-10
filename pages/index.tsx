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

// ⏳ Time Remaining Helper
function getTimeRemainingText(eventTime: string): string {
  const now = new Date()
  const end = new Date(eventTime)
  const diff = end.getTime() - now.getTime()

  if (diff <= 0) return "Expired"

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)

  if (days > 0 && hours > 0) return `Ends in ${days} day${days > 1 ? "s" : ""} ${hours} hour${hours > 1 ? "s" : ""}`
  if (days > 0) return `Ends in ${days} day${days > 1 ? "s" : ""}`
  return `Ends in ${hours} hour${hours > 1 ? "s" : ""}`
}

// Dummy Market Data (Replace with actual data from API)
const dummyMarkets = [
  {
    question: "Will US CPI exceed 3.5% in July 2025?",
    eventTime: "2025-07-12T23:00:00Z",
  },
  {
    question: "Will unemployment fall below 4%?",
    eventTime: "2025-07-15T12:00:00Z",
  },
]

export default function Home() {
  const [isClient, setIsClient] = useState(false)
  const { address } = useEthereum()

  useEffect(() => {
    setIsClient(true)
  }, [])

  const USDT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
  const USDC_ADDRESS = "0xA0b86991C6218B36c1d19D4a2e9Eb0cE3606EB48"

  const usdtBalance = isClient && address ? useTokenBalance(USDT_ADDRESS) : null
  const usdcBalance = isClient && address ? useTokenBalance(USDC_ADDRESS) : null

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
          <div className="mb-6">
            <ConnectWalletButton />
          </div>

          {address && (
            <div className="mb-6">
              <p>USDT Balance: {usdtBalance ?? "Loading..."}</p>
              <p>USDC Balance: {usdcBalance ?? "Loading..."}</p>
            </div>
          )}

          {address && (
            <div className="mb-8">
              <TradeForm />
            </div>
          )}

          {/* 🔥 Markets Section */}
          <div className="w-full">
            <h2 className="text-xl font-bold mb-4">Prediction Markets Today</h2>
            {dummyMarkets.map((market, i) => (
              <div
                key={i}
                className="bg-[#00423b] text-white rounded-xl p-4 mb-4"
              >
                <p className="text-lg font-semibold">{market.question}</p>
                <p className="text-sm mt-1">⏳ {getTimeRemainingText(market.eventTime)}</p>
              </div>
            ))}
          </div>

          {/* Branding */}
          <Image
            className={styles.logo}
            src="/next.svg"
            alt="Next.js logo"
            width={180}
            height={38}
            priority
          />
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
