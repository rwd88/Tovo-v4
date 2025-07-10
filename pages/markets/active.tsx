// pages/markets/active.tsx
import React, { useEffect, useState } from 'react';

type Market = {
  id: string;
  question: string;
  eventTime: string;
  poolYes: number;
  poolNo: number;
  // Add more fields if needed
};

export default function ActiveMarkets() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/markets/active')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setMarkets(data.markets);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch markets:', err);
        setError('Failed to load markets');
      });
  }, []);

  if (error) {
    return <p className="text-red-500 text-center">{error}</p>;
  }

  if (!markets.length) {
    return <p className="text-center">No active markets available.</p>;
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Active Markets</h1>
      <ul className="space-y-4">
        {markets.map((market) => (
          <li key={market.id} className="border p-4 rounded-md">
            <p className="font-medium">{market.question}</p>
            <p className="text-sm text-gray-500">Event Time: {new Date(market.eventTime).toLocaleString()}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
