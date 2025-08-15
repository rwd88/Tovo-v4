// scripts/derive-tron-address.cjs
const TronWeb = require('tronweb')

const pk = process.env.TRON_PRIVATE_KEY
if (!pk) {
  console.error("ERROR: TRON_PRIVATE_KEY not set")
  process.exit(1)
}

const tron = new TronWeb({ fullHost: process.env.TRON_RPC_URL })
console.log("Tron house address:", tron.address.fromPrivateKey(pk))
