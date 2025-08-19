// src/lib/payout.ts
import { ethers } from 'ethers'

// ---- Minimal ERC20 ABI ----
const ERC20_ABI = ['function transfer(address to, uint256 amount) public returns (bool)']

// ---- Env (read but do not throw here) ----
const RPC_URL         = process.env.EVM_RPC_URL || ''
const ADMIN_PRIV_KEY  = process.env.EVM_PRIVATE_KEY || ''
const TOKEN_ADDRESS   = process.env.USDC_MAINNET || ''
// support both names for the admin house wallet address
const ADMIN_ADDRESS   =
  process.env.HOUSE_WALLET_ADDRESS ||
  process.env.FEE_WALLET_ADDRESS ||
  ''

// allow override; default USDC/USDT decimals = 6
const TOKEN_DECIMALS  = Number(process.env.TOKEN_DECIMALS ?? 6)

let provider: ethers.providers.JsonRpcProvider | null = null
let signer: ethers.Wallet | null = null
let token: ethers.Contract | null = null

/** Return whether payouts are fully configured + which vars are missing. */
export function isPayoutEnabled() {
  const missing: string[] = []
  if (!RPC_URL)        missing.push('EVM_RPC_URL')
  if (!ADMIN_PRIV_KEY) missing.push('EVM_PRIVATE_KEY')
  if (!TOKEN_ADDRESS)  missing.push('USDC_MAINNET')
  if (!ADMIN_ADDRESS)  missing.push('HOUSE_WALLET_ADDRESS (or FEE_WALLET_ADDRESS)')
  return { ok: missing.length === 0, missing }
}

function ensureInited() {
  if (provider && signer && token) return
  const { ok, missing } = isPayoutEnabled()
  if (!ok) {
    const why = `payout disabled; missing env: ${missing.join(', ')}`
    throw new Error(why)
  }
  provider = new ethers.providers.JsonRpcProvider(RPC_URL)
  signer   = new ethers.Wallet(ADMIN_PRIV_KEY!, provider)
  token    = new ethers.Contract(TOKEN_ADDRESS!, ERC20_ABI, signer)
}

/** Pay `amount` tokens (human units, e.g. 1.23) to `toAddress`. Returns tx hash. */
export async function payToken(toAddress: string, amount: number): Promise<string> {
  ensureInited()
  const units = ethers.utils.parseUnits(amount.toString(), TOKEN_DECIMALS)
  const tx    = await token!.transfer(toAddress, units)
  await tx.wait()
  return tx.hash
}

/** Convenience: send `amount` to the admin/house wallet. */
export async function payHouse(amount: number): Promise<string> {
  return payToken(ADMIN_ADDRESS!, amount)
}
