import { NextResponse } from "next/server";
import type { FaceConsistencyPayload } from "@/lib/faceConsistency";
import { runFaceConsistentInference } from "@/lib/ai/inference";
import { auth } from "@/lib/auth";
import { debitCredits, getUserById } from "@/lib/db/credits";
import { checkGenerateRateLimit } from "@/lib/rateLimit";
import { FREE_CREDITS, REGENERATE_CREDIT_COST } from "@/lib/data";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Portrait generate / regenerate (#105–#106).
 * - Validates face-consistency payload (max face weights)
 * - Rate-limits by IP / account
 * - Debits 1.0 (initial) or 0.5 (regenerate) when authenticated
 * - Calls Replicate / RunPod / ComfyUI when configured
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as FaceConsistencyPayload;
    if (!body?.selfieUrls?.length && body.mode === "initial") {
      return NextResponse.json({ error: "selfieUrls required" }, { status: 400 });
    }
    if (body.mode === "regenerate" && (!body.draftUrl || !body.selfieUrls?.length)) {
      return NextResponse.json(
        { error: "dual reference requires selfieUrls + draftUrl" },
        { status: 400 }
      );
    }

    if ((body.faceId?.faceWeight ?? 0) < 1 || (body.ipAdapter?.faceIdWeight ?? 0) < 1) {
      return NextResponse.json(
        { error: "face consistency weights must be maximized (1.0)" },
        { status: 400 }
      );
    }

    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

    const rl = checkGenerateRateLimit(req, userId);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "rate_limited", resetAt: rl.resetAt },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
            "X-RateLimit-Limit": String(rl.limit),
          },
        }
      );
    }

    const cost =
      body.creditCost ??
      (body.mode === "regenerate" ? REGENERATE_CREDIT_COST : 1);

    let creditsAfter: number | null = null;
    let ledgerId: string | null = null;

    if (userId) {
      const debit = await debitCredits({
        userId,
        amount: cost,
        reason: body.mode === "regenerate" ? "regenerate" : "generate",
        meta: { mode: body.mode, aspectRatio: body.aspectRatio },
      });
      if (!debit.ok) {
        if (debit.reason === "insufficient") {
          return NextResponse.json(
            { error: "insufficient_credits", credits: debit.credits },
            { status: 402 }
          );
        }
        return NextResponse.json({ error: "user not found" }, { status: 404 });
      }
      creditsAfter = debit.user.credits;
      ledgerId = debit.entry.id;
    }

    const inference = await runFaceConsistentInference(body);
    const user = userId ? await getUserById(userId) : null;

    return NextResponse.json({
      ok: inference.status !== "failed",
      mode: body.mode,
      creditCost: cost,
      creditsAfter: creditsAfter ?? user?.credits ?? FREE_CREDITS,
      ledgerId,
      identityLock: body.identityLock,
      dualReference: body.dualReference,
      inference,
      status: inference.status,
      imageUrls: inference.imageUrls,
      message: inference.message,
    });
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
}
