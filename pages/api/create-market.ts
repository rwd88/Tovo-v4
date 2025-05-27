// pages/api/create-market.ts
import { PrismaClient } from '@prisma/client'
import type { NextApiRequest, NextApiResponse } from 'next'

const prisma = new PrismaClient()

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST method is allowed' })
  }

  try {
    const {
      question,
      status,
      eventTime,
      forecast,
      outcome,
      poolYes,
      poolNo,
    } = req.body

    // Validate payload
    if (
      !question ||
      !status ||
      !eventTime ||
      forecast === undefined ||
      poolYes === undefined ||
      poolNo === undefined
    ) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Create the market record
    const market = await prisma.market.create({
      data: {
        question,
        status,
        eventTime: new Date(eventTime),
        forecast,
        outcome,
        poolYes,
        poolNo,
      },
    })

    return res.status(200).json(market)
  } catch (error) {
    console.error('Create market error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}