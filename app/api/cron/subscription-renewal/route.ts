import { NextResponse } from "next/server";
import { processSubscriptionRenewals } from "@/lib/subscriptionRenewal";

export const runtime = "nodejs";

/** Daily cron: charge KCP monthly subscribers via stored billing keys. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const cronHeader = req.headers.get("x-cron-secret");

  if (secret && auth !== `Bearer ${secret}` && cronHeader !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await processSubscriptionRenewals();
  return NextResponse.json({
    ok: true,
    ...result,
    ranAt: new Date().toISOString(),
  });
}
