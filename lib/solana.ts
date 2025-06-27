/* eslint-disable @typescript-eslint/no-explicit-any */
import { Connection, PublicKey } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

/**
 * Fetches the SPL token balance (in human‐readable units) for a given mint and owner.
 */
export async function getSplTokenBalance(
  connection: Connection,
  mintAddress: string,
  ownerAddress: string
): Promise<number> {
  const ownerPubkey = new PublicKey(ownerAddress);
  const mintPubkey  = new PublicKey(mintAddress);

  // Derive the associated token account for this owner+mint
  const ata = await getAssociatedTokenAddress(mintPubkey, ownerPubkey);

  // Query the balance
  const { value } = await connection.getTokenAccountBalance(ata);

  return value.uiAmount || 0;
}

/**
 * Returns the standard SPL Token program ID constant.
 */
export const SPL_TOKEN_PROGRAM_ID = TOKEN_PROGRAM_ID;
