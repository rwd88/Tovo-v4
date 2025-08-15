// scripts/derive-solana-address.cjs
const { Keypair } = require('@solana/web3.js')

const secretJson = process.env.SOLANA_PRIVATE_KEY
if (!secretJson) {
  console.error("ERROR: SOLANA_PRIVATE_KEY not set")
  process.exit(1)
}

const secret = Uint8Array.from(JSON.parse(secretJson))
const kp     = Keypair.fromSecretKey(secret)
console.log("Solana house address:", kp.publicKey.toBase58())
