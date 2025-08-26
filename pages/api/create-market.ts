// pages/api/create-market.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../lib/prisma'

export const runtime = 'nodejs'

type CreateMarketRequest = {
  externalId: string
  question: string
  status: string
  eventTime: string | Date
  forecast?: number
  outcome?: string
  poolYes: number
  poolNo: number
  onchainId?: string | number | null // ✅ optional numeric id from the contract
}

type CreateMarketResponse =
  | { success: true; market: any }
  | { success: false; error: string }

function toBigIntOrNull(v: unknown): bigint | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number' && Number.isFinite(v)) return BigInt(v)
  if (typeof v === 'string' && /^\d+$/.test(v)) return BigInt(v)
  return null
}

function serialize(m: any) {
  return {
    ...m,
    onchainId:
      m?.onchainId == null
        ? null
        : typeof m.onchainId === 'bigint'
        ? m.onchainId.toString()
        : String(m.onchainId),
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CreateMarketResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Only POST allowed' })
  }

  // simple auth (cron/admin)
  const secret = (req.query.secret as string) || req.headers['x-cron-secret']
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ success: false, error: 'Unauthorized: invalid secret' })
  }

  const {
    externalId,
    question,
    status,
    eventTime,
    forecast,
    outcome,
    poolYes,
    poolNo,
    onchainId,
  } = (req.body || {}) as CreateMarketRequest

  // validate
  if (
    !externalId ||
    !question ||
    !status ||
    !eventTime ||
    typeof poolYes !== 'number' ||
    typeof poolNo !== 'number'
  ) {
    return res
      .status(400)
      .json({ success: false, error: 'Missing or invalid required fields' })
  }

  try {
    const eventAt = new Date(eventTime)
    if (isNaN(eventAt.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid eventTime' })
    }

    const onchainBig = toBigIntOrNull(onchainId)

    // build data
    const data: Parameters<typeof prisma.market.create>[0]['data'] = {
      externalId,
      question,
      status,
      eventTime: eventAt,
      poolYes,
      poolNo,
      ...(forecast !== undefined ? { forecast } : {}),
      ...(outcome !== undefined ? { resolvedOutcome: outcome } : {}),
      ...(onchainBig !== null ? { onchainId: onchainBig } : {}), // ✅ save numeric id if provided
    }

    const created = await prisma.market.create({ data })
    return res.status(201).json({ success: true, market: serialize(created) })
  } catch (err: any) {
    console.error('Create market error:', err)
    return res
      .status(500)
      .json({ success: false, error: `Server error: ${err?.message || 'unknown'}` })
  }
}
