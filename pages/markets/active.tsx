// /pages/markets/active.tsx
import { GetStaticProps } from 'next';

type Market = {
  id: string;
  externalId: string | null;
  question: string;
  eventTime: string; // serialized as ISO string
  poolYes: number;
  poolNo: number;
};

type Props = {
  markets: Market[];
};

export const getStaticProps: GetStaticProps<Props> = async () => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/markets/active`);
  const data = await res.json();

  if (!Array.isArray(data)) {
    console.error("Markets API returned non-array:", data);
    return { props: { markets: [] } };
  }

  return {
    props: { markets: data },
    revalidate: 60,
  };
};

export default function ActiveMarketsPage({ markets }: Props) {
  return (
    <div>
      <h1>Active Markets</h1>
      {markets.length === 0 ? (
        <p>No active markets.</p>
      ) : (
        markets.map((m) => (
          <div key={m.id}>
            <h3>{m.question}</h3>
            <p>Yes: {m.poolYes}</p>
            <p>No: {m.poolNo}</p>
            <p>Event Time: {new Date(m.eventTime).toLocaleString()}</p>
          </div>
        ))
      )}
    </div>
  );
}
