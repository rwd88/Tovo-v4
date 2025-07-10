import { GetStaticProps } from 'next';
import { prisma } from '../../lib/prisma';

type Market = {
  id: string;
  externalId: string | null;
  question: string;
  eventTime: string; // updated from Date
  poolYes: number;
  poolNo: number;
};

type Props = {
  markets: Market[];
};

export const getStaticProps: GetStaticProps<Props> = async () => {
  try {
    const now = new Date();

    const markets = await prisma.market.findMany({
      where: {
        status: 'open',
        eventTime: { gt: now },
      },
      orderBy: { eventTime: 'asc' },
      select: {
        id: true,
        externalId: true,
        question: true,
        eventTime: true,
        poolYes: true,
        poolNo: true,
      },
    });

    return {
      props: {
  markets: markets.map((m) => ({
    ...m,
    eventTime: m.eventTime.toISOString(),
  })),
}
      revalidate: 60,
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

const ActiveMarketPage = ({ markets }: Props) => {
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

export default ActiveMarketPage;
