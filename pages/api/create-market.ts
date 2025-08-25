// pages/api/create-market.ts
import type { NextApiRequest, NextApiResponse } from "next"
import prisma from "../../lib/prisma"                 // ✅ default import, correct path
import { sendMarketToTelegram } from "../../lib/telegram/sendMarket"

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

type CreateMarketResponse =
  | { success: true; market: Awaited<ReturnType<typeof prisma.market.create>> }
  | { success: false; error: string }

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CreateMarketResponse>
) {
  // 1) Only POST
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Only POST allowed" })
  }

  // 2) Secret check
  const secret = req.query.secret as string
  if (secret !== process.env.CRON_SECRET) {
    return res
      .status(401)
      .json({ success: false, error: "Unauthorized: invalid secret" })
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
  } = req.body as CreateMarketRequest

  // 3) Validate
  if (
    !externalId ||
    !question ||
    !status ||
    !eventTime ||
    typeof poolYes !== "number" ||
    typeof poolNo !== "number"
  ) {
    return res
      .status(400)
      .json({ success: false, error: "Missing or invalid required fields" })
  }

  try {
    // 4) Build data payload
    const data: Parameters<typeof prisma.market.create>[0]["data"] = {
      externalId,
      question,
      status,
      eventTime: new Date(eventTime),
      poolYes,
      poolNo,
      ...(forecast !== undefined ? { forecast } : {}),
      ...(outcome !== undefined ? { resolvedOutcome: outcome } : {}),
    }

    // 5) Create
    const market = await prisma.market.create({ data })

    // 6) Push immediately to Telegram
    await sendMarketToTelegram(market)

    return res.status(201).json({ success: true, market })
  } catch (err: any) {
    console.error("Create market error:", err)
    return res
      .status(500)
      .json({ success: false, error: "Server error: " + err.message })
  }
}
