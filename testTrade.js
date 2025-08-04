// testTrade.js
require('dotenv').config()
const fetch = require('node-fetch')
const { ethers } = require('ethers')

async function main() {
  const siteUrl   = process.env.NEXT_PUBLIC_SITE_URL
  const rpcUrl    = process.env.NEXT_PUBLIC_ETH_RPC_URL
  const privKey   = process.env.EVM_PRIVATE_KEY
  const marketId  = process.env.TEST_MARKET_ID    // set this in your .env
  const amount    = parseFloat(process.env.TEST_AMOUNT  || '0.01')
  const side      = process.env.TEST_SIDE      || 'UP'

  if (!siteUrl || !rpcUrl || !privKey || !marketId) {
    console.error('❌ Please set NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_ETH_RPC_URL, EVM_PRIVATE_KEY and TEST_MARKET_ID in your .env')
    process.exit(1)
  }

  // 1) Create a wallet from your private key
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
  const wallet   = new ethers.Wallet(privKey, provider)
  const address  = await wallet.getAddress()
  console.log('🔑 Wallet address:', address)

  // 2) Fetch the one-time nonce
  console.log('⏳ Fetching nonce…')
  let res = await fetch(`${siteUrl}/api/nonce?address=${address}`)
  if (!res.ok) throw new Error(`Nonce fetch failed: ${res.status}`)
  const { nonce } = await res.json()
  console.log('🔢 Nonce:', nonce)

  // 3) Sign the nonce
  console.log('✍️ Signing nonce…')
  const signature = await wallet.signMessage(nonce)
  console.log('🖋 Signature:', signature)

  // 4) Submit the trade
  console.log('🚀 Submitting trade…')
  res = await fetch(`${siteUrl}/api/trade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      marketId,
      walletAddress: address,
      amount,
      side,
      signature,
    }),
  })
  const body = await res.json()
  console.log('📬 Response:', body)
}

main().catch((err) => {
  console.error('❌ Test failed:', err)
  process.exit(1)
})
