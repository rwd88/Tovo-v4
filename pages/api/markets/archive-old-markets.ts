import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "../../../lib/prisma"                 // ✅ default import, correct path

export const config = {
  api: { bodyParser: false },
  maxDuration: 60,
};

type Resp = {
  ok: boolean;
  archived?: number;
  deleted?: number;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Resp>
) {
  try {
    const token =
      (req.query.secret as string) ||
      req.headers.authorization?.replace("Bearer ", "") ||
      (req.headers["x-cron-secret"] as string) ||
      "";

    if (token !== (process.env.CRON_SECRET || "12345A")) {
      return res.status(403).json({ ok: false, error: "Unauthorized" });
    }

    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const now = new Date();

    // 1️⃣ Archive: past un-resolved events
    const archiveResult = await prisma.market.updateMany({
      where: {
        status: { in: ["open", "OPEN"] },
        resolved: false,
        resolvedOutcome: null,
        eventTime: { lt: now },
      },
      data: { status: "archived" },
    });

    // 2️⃣ Optional hard delete for long-archived
    const retentionDays = Number(process.env.ARCHIVE_RETENTION_DAYS ?? 30);
    const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

    const oldArchived = await prisma.market.findMany({
      where: { status: "archived", eventTime: { lt: cutoff } },
      select: { id: true },
      take: 100,
    });

    let deleted = 0;
    if (oldArchived.length > 0) {
      const ids = oldArchived.map((m) => m.id);
      await prisma.$transaction([
        prisma.trade.deleteMany({ where: { marketId: { in: ids } } }),
        prisma.outcome.deleteMany({ where: { marketId: { in: ids } } }),
        prisma.market.deleteMany({ where: { id: { in: ids } } }),
      ]);
      deleted = ids.length;
    }

    return res.status(200).json({
      ok: true,
      archived: archiveResult.count,
      deleted,
    });
  } catch (err: any) {
    console.error("❌ archive-old-markets failed", err);
    return res
      .status(500)
      .json({ ok: false, error: err.message || "Server error" });
  }
}
