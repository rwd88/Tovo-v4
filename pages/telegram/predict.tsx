// Simple prediction form
export default function PredictForm({ marketId }: { marketId: string }) {
  return (
    <div className="p-4">
      <button onClick={() => placeBet('YES')}>✅ YES</button>
      <button onClick={() => placeBet('NO')}>❌ NO</button>
    </div>
  )
}