'use client';

import { useEffect, useState } from 'react';

export default function PredictForm({ marketId }: { marketId: string }) {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initDataUnsafe?.user) {
      const tgUser = (window as any).Telegram.WebApp.initDataUnsafe.user;
      setUserId(String(tgUser.id));
    }
  }, []);

  const placeBet = async (type: 'YES' | 'NO') => {
    if (!userId) {
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
        type
      })
    });

    const data = await res.json();
    alert(data.success ? '✅ Trade placed!' : `❌ Error: ${data.error}`);
  };

  return (
    <div className="p-4 space-x-4">
      <button onClick={() => placeBet('YES')}>✅ YES</button>
      <button onClick={() => placeBet('NO')}>❌ NO</button>
    </div>
  );
}
