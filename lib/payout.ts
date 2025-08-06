// src/lib/payout.ts
import { ethers } from 'ethers'

// —— Minimal ERC-20 ABI for `transfer` ——
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) public returns (bool)"
]

// —— Load environment ——
const RPC_URL        = process.env.EVM_RPC_URL!          // already set in Vercel
const ADMIN_PRIV_KEY = process.env.EVM_PRIVATE_KEY!      // already set in Vercel
const TOKEN_ADDRESS  = process.env.USDC_MAINNET!         // already set in Vercel
const ADMIN_ADDRESS  = process.env.FEE_WALLET_ADDRESS!   // **NEW**: add this in Vercel

const DECIMALS       = 6  // USDC has 6 decimals

if (!RPC_URL || !ADMIN_PRIV_KEY || !TOKEN_ADDRESS || !ADMIN_ADDRESS) {
  throw new Error("Missing payout configuration in env")
}

// —— Setup provider & wallet ——
const provider      = new ethers.providers.JsonRpcProvider(RPC_URL)
const adminWallet   = new ethers.Wallet(ADMIN_PRIV_KEY, provider)
const tokenContract = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, adminWallet)

/**
 * Transfer `amount` tokens (human units, e.g. 1.23) to `toAddress`.
 * Returns the transaction hash.
 */
export async function payToken(toAddress: string, amount: number): Promise<string> {
  const units = ethers.utils.parseUnits(amount.toString(), DECIMALS)
  const tx    = await tokenContract.transfer(toAddress, units)
  await tx.wait()
  return tx.hash
}

/**
 * Convenience: pay the house/admin fee to the configured ADMIN_ADDRESS
 */
export async function payHouse(amount: number): Promise<string> {
  return payToken(ADMIN_ADDRESS, amount)
}
