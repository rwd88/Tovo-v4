// pages/api/withdraw/execute.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { JsonRpcProvider, Contract, Wallet } from 'ethers'
import {
  Connection,
  Keypair,
  Transaction,
  SystemProgram,
  PublicKey
} from '@solana/web3.js'
import TonWeb from 'tonweb'

// Minimal ERC-20 ABI
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)'
]

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }

  const { chainId, address, asset, amount, withdrawId } = req.body
  if (!chainId || !address || !asset || !amount || !withdrawId) {
    return res.status(400).json({ error: 'Missing parameters' })
  }

  try {
    // 1) mark processing
    await prisma.withdrawal.update({
      where: { id: String(withdrawId) },
      data:  { status: 'processing' },
    })

    let txHash: string

    // 2a) EVM
    if (chainId === parseInt(process.env.EVM_CHAIN_ID!)) {
      const provider = new JsonRpcProvider(process.env.ETH_RPC_URL)
      const signer   = new Wallet(process.env.EVM_WITHDRAWER_KEY!, provider)
      const token    = new Contract(asset, ERC20_ABI, signer)
      const tx       = await token.transfer(address, amount)
      txHash = tx.hash

    // 2b) Solana
    } else if (chainId === parseInt(process.env.SOLANA_CHAIN_ID!)) {
      const conn  = new Connection(process.env.SOLANA_RPC_URL!)
      const payer = Keypair.fromSecretKey(
        Buffer.from(process.env.SOLANA_WITHDRAWER_KEY!, 'base64')
      )
      const tx    = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey:   new PublicKey(address),
          lamports:   BigInt(amount),
        })
      )
      const sig   = await conn.sendTransaction(tx, [payer])
      txHash = sig

    // 2c) TON
    } else if (chainId === parseInt(process.env.TON_CHAIN_ID!)) {
      const tonweb = new TonWeb(
        new TonWeb.HttpProvider(process.env.TON_RPC_URL!)
      )
      // suppress TS error: TonWeb types don’t expose `wallet`
      // @ts-ignore
      const wallet = tonweb.wallet.create({
        secretKey: Buffer.from(
          process.env.TON_WITHDRAWER_KEY!,
          'hex'
        )
      })
      const seqno = await wallet.methods.seqno().call()
      const transfer = await wallet.methods
        .transfer({
          toAddress: address,
          amount:    BigInt(amount),
          seqno,
          sendMode:  0,
        })
        .send()
      txHash = transfer.idHash

    } else {
      throw new Error(`Unsupported chainId: ${chainId}`)
    }

    // 3) mark sent
    const updated = await prisma.withdrawal.update({
      where: { id: String(withdrawId) },
      data:  { status: 'sent', txHash },
    })

    return res.status(200).json({ success: true, withdrawal: updated })
  } catch (err: any) {
    console.error('withdraw execute error:', err)
    // mark failed
    await prisma.withdrawal.update({
      where: { id: String(withdrawId) },
      data:  { status: 'failed' },
    })
    return res.status(500).json({ success: false, error: err.message })
  }
}
