import { NextResponse } from "next/server";
import { processSubscriptionExpiries } from "@/lib/subscriptionLifecycle";

export const runtime = "nodejs";

/** Daily cron: expire CANCELED_PENDING / past-period subscriptions (#113). */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const cronHeader = req.headers.get("x-cron-secret");

  if (secret && auth !== `Bearer ${secret}` && cronHeader !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await processSubscriptionExpiries();
  return NextResponse.json({
    ok: true,
    ...result,
    ranAt: new Date().toISOString(),
  });
}
