import { GetStaticProps } from 'next';

type Market = {
  id: string;
  externalId: string | null;
  question: string;
  eventTime: string;
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
              Event Time: {new Date(market.eventTime).toLocaleString()}
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
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/markets/active`);
    const markets: Market[] = await res.json();

    return {
      props: {
        markets,
      },
      revalidate: 10, // ISR - revalidate every 10 seconds
    };
  } catch (error) {
    console.error('[getStaticProps] error:', error);
    return {
      props: {
        markets: [],
      },
    };
  }
};

export default ActiveMarketsPage;
