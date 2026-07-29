import { NextResponse } from "next/server";
import { expirePromotionCodes } from "@/lib/promotions";

export const runtime = "nodejs";

/** Daily cron: expire prepaid promotion balances 180 days after issuance. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  }
  const authorization = req.headers.get("authorization");
  const cronHeader = req.headers.get("x-cron-secret");
  if (secret && authorization !== `Bearer ${secret}` && cronHeader !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await expirePromotionCodes();
  return NextResponse.json({
    ok: true,
    ...result,
    ranAt: new Date().toISOString(),
  });
}
