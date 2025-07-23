// pages/admin/deposits.tsx
+ 'use client'

import { useEffect, useState } from 'react'

type Deposit = {
  id: string
  network: string
  txHash: string
  status: string
  createdAt: string
}

export default function DepositsAdmin() {
  const [deposits, setDeposits] = useState<Deposit[]>([])

  useEffect(() => {
    fetch('/api/admin/deposits')
      .then(res => res.json())
      .then(setDeposits)
      .catch(console.error)
  }, [])

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/admin/deposit/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setDeposits(deposits.map(d => d.id === id ? { ...d, status } : d))
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl mb-4">Deposit Review</h1>
      <table className="min-w-full border">
        <thead>
          <tr>
            <th>ID</th><th>Network</th><th>TX Hash</th><th>Status</th><th>Time</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {deposits.map(d => (
            <tr key={d.id} className="border-t">
              <td>{d.id}</td>
              <td>{d.network}</td>
              <td><code>{d.txHash}</code></td>
              <td>{d.status}</td>
              <td>{new Date(d.createdAt).toLocaleString()}</td>
              <td className="space-x-2">
                {d.status !== 'approved' && (
                  <button onClick={() => updateStatus(d.id, 'approved')}>Approve</button>
                )}
                {d.status !== 'rejected' && (
                  <button onClick={() => updateStatus(d.id, 'rejected')}>Reject</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
