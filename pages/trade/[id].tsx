import { useRouter } from 'next/router';

export default function TradePage() {
  const router = useRouter();
  const { id, side } = router.query;

  return (
    <div>
      <h1>Trade Page</h1>
      <p>Market ID: {id}</p>
      <p>Side: {side}</p>
    </div>
  );
}
