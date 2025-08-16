// convert-solana-key.mjs
import bs58 from 'bs58'

const base58Key = 'GQdqVArgxjh3zMDSkEPvYkFhgLRPrZdJAHwV8hhVniCT'
const decoded = bs58.decode(base58Key)

console.log(JSON.stringify(Array.from(decoded)))
