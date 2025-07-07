// pages/dashboard.tsx
import { useEffect, useState } from 'react'
import QRCode from 'react-qr-code'

interface DepositAddress {
  id: number
  chainId: number
  address: string
}

interface DepositRecord {
  id: number
  chainId: number
  amount: string
  status: string
  createdAt: string
}

interface WithdrawalRecord {
  id: string
  chain: string
  asset: string
  amount: number
  status: string
  txHash?: string
  createdAt: string
}

export default function Dashboard() {
  const [addresses, setAddresses] = useState<DepositAddress[]>([])
  const [deposits, setDeposits]   = useState<DepositRecord[]>([])
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([])

  const [network, setNetwork]     = useState('1')
  const [asset, setAsset]         = useState('') 
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount]       = useState('') 
  const [isSubmitting, setIsSubmitting] = useState(false)

  // load deposit‐addresses, deposits & withdrawals
  useEffect(() => {
    fetch('/api/deposit-addresses')
      .then(r => r.json())
      .then(setAddresses)
      .catch(console.error)

    Promise.all([
      fetch('/api/deposits/ton').then(r => r.json()),
      fetch('/api/deposits/evm').then(r => r.json()),
    ])
      .then(([ton, evm]) => setDeposits([
        ...ton.map((d: any) => ({ ...d, chainId: 'TON' })),
        ...evm.map((d: any) => ({ ...d, chainId: 'EVM' }))
      ]))
      .catch(console.error)

    fetch('/api/withdraw')
      .then(r => r.json())
      .then(setWithdrawals)
      .catch(console.error)
  }, [])

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      // 1) Create withdrawal
      const createRes = await fetch('/api/withdraw/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId:    'cuidYOURUSERID',    // TODO: replace with your real user id
          chain:     network === '1' ? 'erc20' : network === '56' ? 'bsc' : 'erc20',
          asset,
          amount:    parseFloat(amount),
          nonce:     Date.now().toString(),
          expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
        })
      })
      if (!createRes.ok) throw new Error(await createRes.text())
      const { id: withdrawId } = await createRes.json()

      // 2) Execute withdrawal
      const smallest = network === '1' || network === '56'
        ? (BigInt(Math.floor(parseFloat(amount) * 1e18))).toString()
        : amount

      const execRes = await fetch('/api/withdraw/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chainId:    parseInt(network, 10),
          address:    recipient,
          asset,
          amount:     smallest,
          withdrawId
        })
      })
      if (!execRes.ok) throw new Error(await execRes.text())
      alert('✅ Withdrawal sent!')

      // 3) Reload withdrawal history
      const updated = await fetch('/api/withdraw').then(r => r.json())
      setWithdrawals(updated)

    } catch (err: any) {
      console.error(err)
      alert('Error: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      {/* Deposit Addresses */}
      <section className="bg-white p-4 rounded shadow">
        <h2 className="text-xl font-bold mb-4">🔗 Deposit Addresses</h2>
        <div className="grid grid-cols-2 gap-4">
          {addresses.map(({ id, chainId, address }) => (
            <div key={id} className="text-center">
              <p className="mb-2 font-mono">Chain {chainId}</p>
              <QRCode value={address} size={96} />
              <p className="mt-2 font-mono text-xs break-all">{address}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Deposit History */}
      <section className="bg-white p-4 rounded shadow">
        <h2 className="text-xl font-bold mb-4">📥 Deposit History</h2>
        <table className="w-full text-left">
          <thead>
            <tr>
              <th>Date</th><th>Chain</th><th>Amount</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {deposits.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="py-2 text-sm">{new Date(d.createdAt).toLocaleString()}</td>
                <td className="text-sm">{d.chainId}</td>
                <td className="text-sm">{d.amount}</td>
                <td className="text-sm capitalize">{d.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Withdrawal History */}
      <section className="bg-white p-4 rounded shadow">
        <h2 className="text-xl font-bold mb-4">📤 Withdrawal History</h2>
        <table className="w-full text-left">
          <thead>
            <tr>
              <th>Date</th><th>Chain</th><th>Asset</th><th>Amount</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {withdrawals.map((w) => (
              <tr key={w.id} className="border-t">
                <td className="py-2 text-sm">{new Date(w.createdAt).toLocaleString()}</td>
                <td className="text-sm">{w.chain}</td>
                <td className="text-sm">{w.asset}</td>
                <td className="text-sm">{w.amount}</td>
                <td className="text-sm capitalize">{w.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Withdrawal Form */}
      <section className="bg-white p-4 rounded shadow">
        <h2 className="text-xl font-bold mb-4">💸 Request Withdrawal</h2>
        <form onSubmit={handleWithdraw} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Network (Chain ID)</label>
            <select
              value={network}
              onChange={e => setNetwork(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="1">Ethereum (1)</option>
              <option value="56">BSC (56)</option>
              {/* add more if needed */}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Token Contract</label>
            <input
              type="text"
              value={asset}
              onChange={e => setAsset(e.target.value)}
              placeholder="0xYourTokenAddress"
              className="w-full p-2 border rounded"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Recipient Address</label>
            <input
              type="text"
              value={recipient}
              onChange={e => setRecipient(e.target.value)}
              placeholder="0xRecipientAddress"
              className="w-full p-2 border rounded"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Amount</label>
            <input
              type="number"
              step="any"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.1"
              className="w-full p-2 border rounded"
              required
            />
          </div>

          <div className="md:col-span-2 text-right">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting…' : 'Request Withdrawal'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
