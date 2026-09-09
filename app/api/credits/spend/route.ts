import { NextResponse } from "next/server";
import { debitCredits } from "@/lib/db/credits";
import { DOWNLOAD_CREDIT_COST } from "@/lib/data";
import { resolveAppUser } from "@/lib/resolveAppUser";
import type { CreditLedgerEntry } from "@/lib/db/types";

export const runtime = "nodejs";

const ALLOWED_REASONS = new Set<CreditLedgerEntry["reason"]>([
  "download",
  "regenerate",
  "generate",
]);

/**
 * Explicit credit spend for client actions that are not gated by /api/generate
 * (e.g. finished-work downloads from the result workspace).
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
    amount?: number;
    reason?: CreditLedgerEntry["reason"];
    meta?: CreditLedgerEntry["meta"];
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  const reason = body.reason && ALLOWED_REASONS.has(body.reason) ? body.reason : "download";
  const amountRaw =
    typeof body.amount === "number" && Number.isFinite(body.amount)
      ? body.amount
      : reason === "download"
        ? DOWNLOAD_CREDIT_COST
        : 1;
  const amount = Math.round(Math.max(0, amountRaw) * 10) / 10;
  if (amount <= 0) {
    return NextResponse.json(
      { error: "invalid_amount", message: "Spend amount must be positive." },
      { status: 400 }
    );
  }

  const debit = await debitCredits({
    userId: resolved.user.id,
    amount,
    reason,
    meta: {
      source: "credits_spend_api",
      ...body.meta,
    },
  });

  if (!debit.ok) {
    if (debit.reason === "insufficient") {
      return NextResponse.json(
        {
          error: "insufficient_credits",
          message: "Insufficient credits.",
          credits: debit.credits ?? resolved.user.credits,
        },
        { status: 402 }
      );
    }
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    creditsAfter: debit.user.credits,
    ledgerId: debit.entry.id,
    amount,
    reason,
  });
}
