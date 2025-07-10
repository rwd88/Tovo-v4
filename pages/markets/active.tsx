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

const ActiveMarketsPage = ({ markets }: Props) => {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Active Markets</h1>
      {markets.length === 0 ? (
        <p>No active markets found.</p>
      ) : (
        <ul>
          {markets.map((market) => (
            <li key={market.id}>
              <strong>{market.question}</strong>
              <br />
              Event Time:{' '}
              {new Date(market.eventTime).toLocaleString()}
              <br />
              Pool Yes: {market.poolYes} | Pool No: {market.poolNo}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const getStaticProps: GetStaticProps<Props> = async () => {
  try {
    const now = new Date();

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/markets`
    );
    const data = await res.json();

    // Ensure all eventTime values are serialized
    const markets: Market[] = data.map((market: any) => ({
      ...market,
      eventTime: new Date(market.eventTime).toISOString(),
    }));

    return {
      props: { markets },
      revalidate: 60, // ISR every 60 seconds
    };
  } catch (error) {
    console.error('[getStaticProps] error:', error);
    return {
      props: { markets: [] },
    };
  }
};

export default ActiveMarketsPage;
