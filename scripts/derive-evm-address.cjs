// scripts/derive-evm-address.cjs
const { Wallet } = require('ethers')

const key = process.env.EVM_PRIVATE_KEY
if (!key) {
  console.error("ERROR: EVM_PRIVATE_KEY not set")
  process.exit(1)
}

const wallet = new Wallet(key)
console.log("EVM house address:", wallet.address)
