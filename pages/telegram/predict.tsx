'use client';

import { useEffect, useState } from 'react';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name?: string;
            last_name?: string;
            username?: string;
          };
        };
      };
    };
  }
}

export default function PredictForm({ marketId }: { marketId: string }) {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (tgUser && tgUser.id) {
      setUserId(String(tgUser.id));
    }
  }, []);

  const placeBet = async (type: 'YES' | 'NO') => {
    const initData = window.Telegram?.WebApp?.initData;

    if (!userId || !initData) {
      alert('Telegram user not detected.');
      return;
    }

    const res = await fetch('/api/trade/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        marketId,
        amount: 10,
        type,
        initData
      })
    });

    const data = await res.json();
    alert(data.success ? '✅ Trade placed!' : `❌ Error: ${data.error}`);
  };

  return (
    <div className="p-4 space-x-4">
      <button onClick={() => placeBet('YES')} className="bg-green-500 text-white px-4 py-2 rounded">✅ YES</button>
      <button onClick={() => placeBet('NO')} className="bg-red-500 text-white px-4 py-2 rounded">❌ NO</button>
    </div>
  );
}
