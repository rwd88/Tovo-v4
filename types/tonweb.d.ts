// types/tonweb.d.ts
declare module 'tonweb' {
  // HTTP provider for talking to a TON RPC node
  export class HttpProvider {
    constructor(url: string);
  }

  // Main TON client
  export default class TonWeb {
    static HttpProvider: typeof HttpProvider;
    constructor(provider: HttpProvider);

    // Get balance in nanograms (string)
    getBalance(address: string): Promise<string>;
  }
}
