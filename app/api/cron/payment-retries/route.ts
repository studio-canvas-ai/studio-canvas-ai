import { NextResponse } from "next/server";
import { processDunningRetries } from "@/lib/dunning";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const cronHeader = req.headers.get("x-cron-secret");
  if (secret && auth !== `Bearer ${secret}` && cronHeader !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await processDunningRetries();
  return NextResponse.json({
    ok: true,
    ...result,
    ranAt: new Date().toISOString(),
  });
}
