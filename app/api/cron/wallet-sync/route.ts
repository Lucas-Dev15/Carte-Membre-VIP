import { NextResponse, type NextRequest } from "next/server";
import { getWalletContext } from "@/lib/app/context";
import { pushIntervalMs } from "@/lib/wallet/config";
import { processDueJobs } from "@/lib/wallet/service";

/**
 * Traite la file wallet_sync_jobs. À appeler chaque minute par un cron
 * (Vercel Cron, crontab…) avec l'en-tête Authorization: Bearer $CRON_SECRET.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const ctx = await getWalletContext();
  const results = await processDueJobs(ctx, { limit: 100, intervalMs: pushIntervalMs() });
  return NextResponse.json({ processed: Object.keys(results).length, results });
}
