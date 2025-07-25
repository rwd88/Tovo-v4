// types/settlement.d.ts
interface SettlementResult {
  success: boolean
  settledCount?: number
  houseProfit?: number
  error?: string
}

interface MarketWithTrades extends Market {
  trades: Trade[]
}