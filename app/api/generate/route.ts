import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  normalizeFaceConsistencyPayload,
  validateRegenerateDualReference,
  type FaceConsistencyPayload,
} from "@/lib/faceConsistency";
import {
  describeAiProviderConfigError,
  resolveInferenceProvider,
  runFaceConsistentInference,
  type InferenceResult,
} from "@/lib/ai/inference";
import { creditUser, debitCredits, getUserById } from "@/lib/db/credits";
import { checkGenerateRateLimit } from "@/lib/rateLimit";
import { FREE_CREDITS, resolveGenerationCost } from "@/lib/data";
import {
  creditPromotionWallet,
  debitPromotionWallet,
  getPromotionByToken,
  PROMO_COOKIE_NAME,
} from "@/lib/promotions";
import { resolveAppUser } from "@/lib/resolveAppUser";
import { enhanceBackgroundFusionPayload } from "@/lib/ai/routeBackgroundScene";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Stay under Vercel’s ~4.5MB request body limit with headroom. */
const MAX_GENERATE_BODY_BYTES = 3_500_000;
/** Inline data URIs in generate body should be tiny; prefer Fal CDN https URLs. */
const MAX_INLINE_DATA_URI_CHARS = 120_000;

function jsonError(
  status: number,
  payload: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    { success: false, ok: false, ...payload },
    { status }
  );
}

/**
 * Portrait generate / regenerate pipeline.
 *
 * Layers:
 *  1) Normalize face-consistency payload (weights floored at 1.0)
 *  2) Rate-limit + debit account / promotion wallet
 *  3) Inference via lib/ai/inference.ts
 *       — Fal Flux Kontext Pro / Replicate / RunPod / ComfyUI when env is set
 *       — Mock A/B drafts when GPU is not wired (no crash)
 *  4) Auto-refund on hard failure; return imageUrls for compare view
 *
 * Clients should POST compact https selfieUrls (via /api/fal/upload), not multi-MB data URIs.
 */
export async function POST(req: Request) {
  let body: FaceConsistencyPayload | null = null;
  let userId: string | null = null;
  let cost = 0;
  let creditsAfter: number | null = null;
  let ledgerId: string | null = null;
  let debitMeta: Record<string, string | number | boolean | null> | undefined;
  let walletSource: "account" | "promotion" | "local_trial" = "local_trial";
  let promoToken: string | undefined;

  try {
    const contentLength = Number(req.headers.get("content-length") || "0");
    if (contentLength > MAX_GENERATE_BODY_BYTES) {
      return jsonError(413, {
        error: "payload_too_large",
        message:
          "Request body too large for /api/generate. Upload faces via /api/fal/upload and send https URLs only.",
      });
    }

    // Hard misconfig only (forced real provider without credentials).
    const configError = describeAiProviderConfigError();
    if (configError) {
      return jsonError(503, {
        error: "ai_provider_unconfigured",
        message: configError,
      });
    }

    let raw: Partial<FaceConsistencyPayload>;
    try {
      raw = (await req.json()) as Partial<FaceConsistencyPayload>;
    } catch (parseErr) {
      console.error("AI API Error:", parseErr);
      return jsonError(400, {
        error: "invalid_json",
        message:
          "Could not parse JSON body. If you sent large images, upload them first and send URLs only.",
      });
    }

    try {
      body = normalizeFaceConsistencyPayload(raw);
    } catch (normErr) {
      console.error("AI API Error:", normErr);
      return jsonError(400, {
        error: "invalid_payload",
        message:
          normErr instanceof Error ? normErr.message : "invalid_payload",
      });
    }

    if (!body.selfieUrls?.length && (body.mode === "initial" || body.mode === "train")) {
      return jsonError(400, {
        error: "selfieUrls required",
        message: "selfieUrls required",
      });
    }
    if (body.mode === "regenerate") {
      const dualRef = validateRegenerateDualReference({
        selfieUrls: body.selfieUrls,
        draftUrl: body.draftUrl,
      });
      if (!dualRef.ok) {
        console.warn("[generate] dual-reference validation failed", {
          code: dualRef.code,
          message: dualRef.message,
        });
        return jsonError(400, {
          error: dualRef.code,
          message: dualRef.message,
        });
      }
      body.selfieUrls = dualRef.selfieUrls;
      body.draftUrl = dualRef.draftUrl;
      if (
        body.fusionMode === "full_rerender" &&
        (body.backgroundKeyword?.trim() || body.backgroundScene?.trim())
      ) {
        body = await enhanceBackgroundFusionPayload(body);
      }
      console.info("[generate] regenerate dual-reference", {
        selfieCount: body.selfieUrls.length,
        hasDraft: Boolean(body.draftUrl),
        fusionMode: body.fusionMode,
        backgroundScene: body.backgroundScene?.slice(0, 80),
        promptLen: body.prompt.length,
      });
    }

    // Reject client-only blob URLs — they are not reachable from the server/GPU provider.
    const allUrls = [
      ...(body.selfieUrls || []),
      ...(body.draftUrl ? [body.draftUrl] : []),
    ];
    if (allUrls.some((u) => typeof u === "string" && u.startsWith("blob:"))) {
      return jsonError(400, {
        error: "invalid_image_url",
        message:
          "Selfie images must be uploaded as https URLs (or small data URLs) before generation.",
      });
    }

    const oversizedData = allUrls.filter(
      (u) =>
        typeof u === "string" &&
        u.startsWith("data:") &&
        u.length > MAX_INLINE_DATA_URI_CHARS
    );
    if (oversizedData.length) {
      return jsonError(413, {
        error: "payload_too_large",
        message:
          "Inline data URIs are too large. Compress and upload via /api/fal/upload, then pass https URLs.",
        oversizedCount: oversizedData.length,
      });
    }

    if ((body.faceId?.faceWeight ?? 0) < 1 || (body.ipAdapter?.faceIdWeight ?? 0) < 1) {
      return jsonError(400, {
        error: "face consistency weights must be maximized (1.0)",
        message: "face consistency weights must be maximized (1.0)",
      });
    }

    // Rehydrate / auto-provision local wallet after Vercel cold starts.
    // Logged-in admin/test sessions must never 404 as "user not found".
    const resolved = await resolveAppUser(req);
    if (resolved.ok) {
      userId = resolved.user.id;
    } else if (resolved.error === "terms_required") {
      return jsonError(401, {
        error: "terms_required",
        message: "Please agree to the terms before generating.",
      });
    }

    const rl = checkGenerateRateLimit(req, userId);
    if (!rl.ok) {
      return NextResponse.json(
        {
          success: false,
          ok: false,
          error: "rate_limited",
          message: "Too many generation requests. Please try again shortly.",
          resetAt: rl.resetAt,
        },
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
    cost = resolveGenerationCost(
      body.mode === "regenerate"
        ? "regenerate"
        : body.mode === "train"
          ? "train"
          : "initial",
      Array.isArray(body.styleIds) ? body.styleIds : []
    );

    if (cost > 0 && userId) {
      const debit = await debitCredits({
        userId,
        amount: cost,
        reason: body.mode === "regenerate" ? "regenerate" : "generate",
        meta: { mode: body.mode, aspectRatio: body.aspectRatio },
      });
      if (!debit.ok) {
        if (debit.reason === "insufficient") {
          return jsonError(402, {
            error: "insufficient_credits",
            message: "Insufficient credits for generation.",
            credits: debit.credits,
          });
        }
        // Should be unreachable after resolveAppUser auto-provision; keep soft path.
        console.warn("[generate] debit not_found after resolve; continuing as local_trial", {
          userId,
        });
        walletSource = "local_trial";
        creditsAfter = FREE_CREDITS;
      } else {
        creditsAfter = debit.user.credits;
        ledgerId = debit.entry.id;
        debitMeta = debit.entry.meta;
        walletSource = "account";
      }
    } else if (cost > 0) {
      const cookieStore = await cookies();
      promoToken = cookieStore.get(PROMO_COOKIE_NAME)?.value;
      const activePromo = getPromotionByToken(promoToken);
      if (activePromo) {
        const debit = await debitPromotionWallet({
          token: promoToken,
          amount: cost,
          mode: body.mode === "initial" ? "generate" : "regenerate",
        });
        if (!debit.ok) {
          return jsonError(402, {
            error:
              debit.reason === "insufficient"
                ? "insufficient_credits"
                : "promotion_expired",
            message:
              debit.reason === "insufficient"
                ? "Insufficient promotion credits for generation."
                : "Promotion code expired.",
            credits: "credits" in debit ? debit.credits : 0,
          });
        }
        creditsAfter = debit.promotion.remainingCredits;
        ledgerId = debit.transactionId;
        walletSource = "promotion";
      }
    } else if (userId && resolved.ok) {
      walletSource = "account";
      creditsAfter = resolved.user.credits;
    }

    let inference: InferenceResult;
    try {
      // Provider chosen inside inference.ts (Fal → Replicate → RunPod → Comfy → mock).
      inference = await runFaceConsistentInference(body);
    } catch (error) {
      console.error("AI API Error:", error);
      inference = {
        provider: resolveInferenceProvider(),
        status: "failed",
        imageUrls: [],
        message: error instanceof Error ? error.message : "inference_error",
      };
    }

    const produced =
      inference.status !== "failed" && inference.imageUrls.length > 0;
    let refunded = false;

    if (!produced && cost > 0) {
      if (walletSource === "account" && userId) {
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
      } else if (walletSource === "promotion" && promoToken) {
        const promoRefund = await creditPromotionWallet({
          token: promoToken,
          amount: cost,
          reason: "generation_failed",
        });
        if (promoRefund.ok) {
          refunded = true;
          creditsAfter = promoRefund.promotion.remainingCredits;
        }
      }
    }

    const user = userId ? await getUserById(userId) : null;

    if (!produced) {
      const message = inference.message ?? "generation_failed";
      console.error("AI API Error:", {
        status: inference.status,
        message,
        provider: inference.provider,
        raw: inference.raw,
      });
      // Use 500 (not 502) so browsers/devtools don't treat a handled failure as a dead gateway.
      return jsonError(500, {
        error: "generation_failed",
        mode: body.mode,
        creditCost: refunded ? 0 : cost,
        refunded,
        creditsAfter: creditsAfter ?? user?.credits ?? FREE_CREDITS,
        walletSource,
        status: inference.status,
        message,
        provider: inference.provider,
        userMessage: refunded
          ? "generation_failed_refunded"
          : "generation_failed",
      });
    }

    // Ensure A/B pair for the compare view (duplicate if provider returned one).
    const imageUrls =
      inference.imageUrls.length >= 2
        ? inference.imageUrls.slice(0, 2)
        : [inference.imageUrls[0], inference.imageUrls[0]];

    return NextResponse.json({
      success: true,
      ok: true,
      mode: body.mode,
      creditCost: cost,
      creditsAfter: creditsAfter ?? user?.credits ?? FREE_CREDITS,
      ledgerId,
      walletSource,
      identityLock: body.identityLock,
      dualReference: body.dualReference,
      inference: { ...inference, imageUrls },
      status: inference.status,
      imageUrls,
      provider: inference.provider,
      mock: inference.provider === "mock",
      message: inference.message,
    });
  } catch (error) {
    console.error("AI API Error:", error);
    return jsonError(500, {
      error: "server_error",
      message: error instanceof Error ? error.message : "unexpected_error",
    });
  }
}
