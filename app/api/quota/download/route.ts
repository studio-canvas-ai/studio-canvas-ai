import { NextResponse } from "next/server";
import { resolveAppUser } from "@/lib/resolveAppUser";
import {
  consumeCreditPool,
  snapshotPlanUsage,
  type DownloadQuotaKind,
} from "@/lib/db/planUsage";
import {
  FEATURE_CREDIT_COST,
  featureCreditAmount,
  type FeatureCreditAction,
} from "@/lib/featureCreditCosts";

export const runtime = "nodejs";

/**
 * Decrement period credit pool (persisted cookie + R2 + Supabase).
 * Body: { action?: FeatureCreditAction, kind?: "fhd"|"uhd4k", amount?: number }
 */
export async function POST(req: Request) {
  const resolved = await resolveAppUser(req);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status }
    );
  }

  let body: {
    kind?: string;
    action?: string;
    amount?: number;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  const fromAction = featureCreditAmount(body.action);
  const kind: DownloadQuotaKind =
    body.kind === "uhd4k" || body.kind === "4k" ? "uhd4k" : "fhd";

  let amount: number;
  if (fromAction != null) {
    amount = fromAction;
  } else if (typeof body.amount === "number" && Number.isFinite(body.amount)) {
    const allowed = new Set<number>(Object.values(FEATURE_CREDIT_COST));
    const n = Math.floor(body.amount);
    if (!allowed.has(n)) {
      return NextResponse.json(
        { error: "invalid_amount", message: "Amount is not an allowed feature cost." },
        { status: 400 }
      );
    }
    amount = n;
  } else {
    amount =
      kind === "uhd4k"
        ? FEATURE_CREDIT_COST.hdDownload
        : FEATURE_CREDIT_COST.webDownload;
  }

  const result = await consumeCreditPool({
    userId: resolved.user.id,
    amount,
  });

  if (!result.ok) {
    const usage = snapshotPlanUsage(resolved.user);
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "not_found", usage }, { status: 404 });
    }
    return NextResponse.json(
      {
        error: "insufficient_quota",
        kind,
        action: (body.action as FeatureCreditAction | undefined) ?? null,
        amount,
        remaining: result.remaining,
        usage,
      },
      { status: 402 }
    );
  }

  return NextResponse.json({
    ok: true,
    kind,
    action: (body.action as FeatureCreditAction | undefined) ?? null,
    amount,
    remaining: result.remaining,
    usage: snapshotPlanUsage(result.user),
  });
}
