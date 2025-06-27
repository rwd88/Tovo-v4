// types/tronweb.d.ts
declare module 'tronweb' {
  export interface Contract {
    methods: {
      balanceOf(address: string): { call(): Promise<string> };
    };
  }

  export interface TronWeb {
    trx: {
      getBalance(address: string): Promise<number>;
    };
    contract(): {
      at(address: string): Promise<Contract>;
    };
  }

  const TronWebConstructor: new (config: { fullHost: string }) => TronWeb;
  export default TronWebConstructor;
}
