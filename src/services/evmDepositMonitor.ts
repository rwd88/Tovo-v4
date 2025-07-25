import { JsonRpcProvider } from "ethers"
import { getDepositAddresses, recordDeposit } from "../models/deposit"

// make sure these two exist in Vercel → Env Vars
const ETH_RPC_URL = process.env.EVM_RPC_URL
const BSC_RPC_URL = process.env.BSC_RPC_URL

if (!ETH_RPC_URL) throw new Error("Missing environment variable: EVM_RPC_URL")
if (!BSC_RPC_URL) throw new Error("Missing environment variable: BSC_RPC_URL")

const RPC: Record<number,string> = {
  1: ETH_RPC_URL,   // Ethereum mainnet
  56: BSC_RPC_URL,  // BSC mainnet
}

interface ChainConfig {
  chainId: number
  provider: JsonRpcProvider
}

const chains: ChainConfig[] = Object.entries(RPC).map(([chainId, url]) => ({
  chainId: Number(chainId),
  provider: new JsonRpcProvider(url),
}))

// (you can persist this in your DB if you like)
const lastProcessed: Record<number, number> = {}

export async function startEvmDepositMonitor() {
  for (const { chainId, provider } of chains) {
    // seed
    lastProcessed[chainId] = await provider.getBlockNumber()

    provider.on("block", async (blockNumber: number) => {
      if (blockNumber <= lastProcessed[chainId]) return
      console.log(`EVM Monitor: new block ${blockNumber} on chain ${chainId}`)

      const addrs = await getDepositAddresses(chainId)
      for (const { address, lastBalance } of addrs) {
        const balance = await provider.getBalance(address)    // bigint
        const oldBal  = BigInt(lastBalance)                   // bigint
        if (balance > oldBal) {
          const delta = balance - oldBal
          console.log(`💰 Deposit detected: ${delta} Wei → ${address}`)
          await recordDeposit({
            chainId,
            address,
            amount:    delta.toString(),
            txHash:    "",     // optional: parse logs for the exact tx
            blockNumber,
          })
        }
      }

      lastProcessed[chainId] = blockNumber
    })
  }

  console.log("✅ EVM deposit monitor started")
  return { status: "started" }
}

// allow `node src/...` testing
if (require.main === module) {
  startEvmDepositMonitor().catch(console.error)
}
