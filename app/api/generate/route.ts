import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { FaceConsistencyPayload } from "@/lib/faceConsistency";
import {
  createMockInferenceResult,
  resolveInferenceProvider,
  runFaceConsistentInference,
  type InferenceResult,
} from "@/lib/ai/inference";
import { auth } from "@/lib/auth";
import { creditUser, debitCredits, getUserById } from "@/lib/db/credits";
import { checkGenerateRateLimit } from "@/lib/rateLimit";
import { FREE_CREDITS, resolveGenerationCost } from "@/lib/data";
import {
  debitPromotionWallet,
  getPromotionByToken,
  PROMO_COOKIE_NAME,
} from "@/lib/promotions";

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

    // Never trust body.creditCost — the client could send 0 to bypass billing.
    const cost = resolveGenerationCost(
      body.mode === "regenerate" ? "regenerate" : "initial",
      Array.isArray(body.styleIds) ? body.styleIds : []
    );

    let creditsAfter: number | null = null;
    let ledgerId: string | null = null;
    let debitMeta: Record<string, string | number | boolean | null> | undefined;
    let walletSource: "account" | "promotion" | "local_trial" = "local_trial";

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
      debitMeta = debit.entry.meta;
      walletSource = "account";
    } else {
      const cookieStore = await cookies();
      const promoToken = cookieStore.get(PROMO_COOKIE_NAME)?.value;
      const activePromo = getPromotionByToken(promoToken);
      if (activePromo) {
        const debit = await debitPromotionWallet({
          token: promoToken,
          amount: cost,
          mode: body.mode === "initial" ? "generate" : "regenerate",
        });
        if (!debit.ok) {
          return NextResponse.json(
            {
              error:
                debit.reason === "insufficient"
                  ? "insufficient_credits"
                  : "promotion_expired",
              credits: "credits" in debit ? debit.credits : 0,
            },
            { status: 402 }
          );
        }
        creditsAfter = debit.promotion.remainingCredits;
        ledgerId = debit.transactionId;
        walletSource = "promotion";
      }
    }

    let inference: InferenceResult;
    try {
      inference = await runFaceConsistentInference(body);
    } catch (err) {
      console.error("[generate] inference threw", err);
      // Mock / unconfigured environments must never surface as 502 — return demo portraits.
      inference =
        resolveInferenceProvider() === "mock"
          ? createMockInferenceResult("inference_error_fallback_demo")
          : {
              provider: resolveInferenceProvider(),
              status: "failed",
              imageUrls: [],
              message: "inference_error",
            };
    }

    // Mock mode always succeeds with demo samples (never empty success).
    if (
      (inference.provider === "mock" || resolveInferenceProvider() === "mock") &&
      (inference.status === "failed" || inference.imageUrls.length === 0)
    ) {
      inference = createMockInferenceResult(inference.message);
    }

    // A charged-but-failed generation is never acceptable: give the credit back.
    const produced = inference.status !== "failed" && inference.imageUrls.length > 0;
    let refunded = false;
    if (!produced && walletSource === "account" && userId && cost > 0) {
      const refundedUser = await creditUser({
        userId,
        amount: cost,
        reason: "refund",
        meta: { mode: body.mode, reason: "generation_failed" },
        restoreFromDebitMeta: debitMeta,
      });
      if (refundedUser) {
        refunded = true;
        creditsAfter = refundedUser.credits;
      }
    }

    const user = userId ? await getUserById(userId) : null;

    if (!produced) {
      return NextResponse.json(
        {
          ok: false,
          error: "generation_failed",
          mode: body.mode,
          creditCost: refunded ? 0 : cost,
          refunded,
          creditsAfter: creditsAfter ?? user?.credits ?? FREE_CREDITS,
          walletSource,
          status: inference.status,
          message: inference.message ?? "generation_failed",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      mode: body.mode,
      creditCost: cost,
      creditsAfter: creditsAfter ?? user?.credits ?? FREE_CREDITS,
      ledgerId,
      walletSource,
      identityLock: body.identityLock,
      dualReference: body.dualReference,
      inference,
      status: inference.status,
      imageUrls: inference.imageUrls,
      message: inference.message,
    });
  } catch (err) {
    console.error("[generate] unhandled error", err);
    return NextResponse.json(
      {
        ok: false,
        error: "server_error",
        message: err instanceof Error ? err.message : "unexpected_error",
      },
      { status: 500 }
    );
  }
}
