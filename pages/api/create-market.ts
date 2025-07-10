  // pages/api/create-market.ts
  import type { NextApiRequest, NextApiResponse } from "next"
  import { prisma } from "../../lib/prisma"

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
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Only POST allowed" })
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

    // Validate required fields
    if (
      !externalId ||
      !question ||
      !status ||
      !eventTime ||
      typeof poolYes !== "number" ||
      typeof poolNo  !== "number"
    ) {
      return res
        .status(400)
        .json({ success: false, error: "Missing or invalid required fields" })
    }

    try {
      // Build up the data object, only including optional fields if they exist
      const data: Parameters<typeof prisma.market.create>[0]["data"] = {
        externalId,
        question,
        status,
        eventTime: new Date(eventTime),
        poolYes,
        poolNo,
        // forecast & outcome are optional
        ...(forecast !== undefined ? { forecast } : {}),
        ...(outcome  !== undefined ? { outcome  } : {}),
      }

// Create the market record
const market = await prisma.market.create({ data })

// 📤 Send it to Telegram channel
await sendMarketToTelegram(market)

return res.status(201).json({ success: true, market })
    } catch (err) {
      console.error("Create market error:", err)
      return res
        .status(500)
        .json({ success: false, error: "Server error: " + (err as Error).message })
    } finally {
      await prisma.$disconnect()
    }
  }
