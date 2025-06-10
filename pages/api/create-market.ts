// pages/api/create-market.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../lib/prisma'

interface CreateMarketRequest {
  externalId: string
  question: string
  status: string
  eventTime: string | Date
  forecast?: number
  outcome?: string
  poolYes: number
  poolNo: number
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST method is allowed' })
  }

  try {
    // Destructure with proper typing
    const {
      externalId,
      question,
      status,
      eventTime,
      forecast,
      outcome,
      poolYes,
      poolNo,
    } = req.body as CreateMarketRequest

    // Validate payload
    if (
      !externalId ||
      !question ||
      !status ||
      !eventTime ||
      poolYes === undefined ||
      poolNo === undefined
    ) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Create the market record
    const market = await prisma.market.create({
      data: {
        externalId,
        question,
        status,
        eventTime: new Date(eventTime), // Now matches schema
        forecast,
        outcome,
        poolYes,
        poolNo,
      },
    })

    return res.status(201).json(market)
  } catch (error) {
    console.error('Create market error:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : undefined
    })
  }
}