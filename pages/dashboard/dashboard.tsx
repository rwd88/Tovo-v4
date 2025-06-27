import { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';

interface DepositAddress {
  id: number;
  chainId: number;
  address: string;
}

interface DepositRecord {
  id: number;
  chainId: number;
  address: string;
  amount: string;
  txHash: string;
  blockNumber: number;
  status: 'pending' | 'confirmed';
  createdAt: string;
}

export default function Dashboard() {
  const [addresses, setAddresses] = useState<DepositAddress[]>([]);
  const [deposits, setDeposits] = useState<DepositRecord[]>([]);
  const [amount, setAmount] = useState('');
  const [network, setNetwork] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/deposit-addresses')
      .then((res) => res.json())
      .then(setAddresses)
      .catch(console.error);

    fetch('/api/deposits')
      .then((res) => res.json())
      .then(setDeposits)
      .catch(console.error);
  }, []);

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ network, amount }),
      });
      if (!res.ok) throw new Error(await res.text());
      alert('Withdrawal requested!');
      setAmount('');
    } catch (err) {
      console.error(err);
      alert('Error requesting withdrawal');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Deposit Addresses */}
      <section className="col-span-1 bg-white p-4 rounded shadow">
        <h2 className="text-lg font-bold mb-4">Deposit Addresses</h2>
        {addresses.map(({ id, chainId, address }) => (
          <div key={id} className="mb-6">
            <p className="font-mono text-sm">Chain {chainId}:</p>
            <QRCode value={address} size={128} />
            <p className="font-mono text-xs mt-2 break-all">{address}</p>
          </div>
        ))}
      </section>

      {/* Deposit History */}
      <section className="col-span-1 md:col-span-2 bg-white p-4 rounded shadow">
        <h2 className="text-lg font-bold mb-4">Deposit History</h2>
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="py-2">Date</th>
              <th>Chain</th>
              <th>Amount</th>
              <th>Status</th>
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

      {/* Withdrawal Form */}
      <section className="col-span-1 md:col-span-3 bg-white p-4 rounded shadow">
        <h2 className="text-lg font-bold mb-4">Request Withdrawal</h2>
        <form onSubmit={handleWithdraw} className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium mb-1">Network (Chain ID)</label>
            <select
              value={network}
              onChange={(e) => setNetwork(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="1">Ethereum (1)</option>
              <option value="56">BSC (56)</option>
              {/* Add other networks here */}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Amount</label>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="0.1"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'Request Withdrawal'}
          </button>
        </form>
      </section>
    </div>
  );
}
