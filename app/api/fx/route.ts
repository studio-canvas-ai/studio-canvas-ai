import { NextResponse } from "next/server";
import {
  ensureUsdKrwRate,
  getUsdKrwRateMeta,
  refreshUsdKrwRate,
} from "@/lib/currency";
import { syncPlanOfferKrw } from "@/lib/data";

export const runtime = "nodejs";

/** Live USD→KRW for pricing UI / clients. Never fails hard — always returns a rate. */
export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get("force") === "1";
  const rate = force
    ? await refreshUsdKrwRate({ force: true })
    : await ensureUsdKrwRate();
  syncPlanOfferKrw();
  const meta = getUsdKrwRateMeta();
  return NextResponse.json({
    rate,
    source: meta.source,
    cachedAt: meta.cachedAt,
    currency: "KRW",
    base: "USD",
  });
}
