// lib/solana.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Connection, PublicKey } from '@solana/web3.js';
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';

/**
 * Fetch SOL balance for a given address.
 */
export async function getSolanaBalance(
  rpcUrl: string,
  address: string
): Promise<number> {
  const conn = new Connection(rpcUrl, 'confirmed');
  const pubkey = new PublicKey(address);
  const lamports = await conn.getBalance(pubkey, 'confirmed');
  return lamports / 1e9;
}

/**
 * Fetch SPL token balance for a given mint/address pair.
 */
export async function getSplTokenBalance(
  rpcUrl: string,
  ownerAddress: string,
  mintAddress: string
): Promise<number> {
  const conn = new Connection(rpcUrl, 'confirmed');
  const ownerPubkey = new PublicKey(ownerAddress);
  const mintPubkey = new PublicKey(mintAddress);
  const token = new Token(conn, mintPubkey, TOKEN_PROGRAM_ID, null as any);
  const account = await token.getOrCreateAssociatedAccountInfo(ownerPubkey);
  return Number(account.amount);
}
