import { NextResponse } from "next/server";
import {
  hasFalCredentials,
  logFalApiError,
  mapAspectToFalImageSize,
  runFalFluxTextToImage,
  type FalImageSizePreset,
} from "@/lib/ai/fal";
import { CommandRouter } from "@/lib/ai/intentRouter";
import {
  isFluxSafeEnglishPrompt,
  sanitizeCommandInput,
} from "@/lib/ai/commandParser";
import { applyVisualOnlyPolicy } from "@/lib/ai/layerPolicy";
import { checkGenerateRateLimit } from "@/lib/rateLimit";
import { resolveAppUser } from "@/lib/resolveAppUser";
import { consumeCreditPool, snapshotPlanUsage } from "@/lib/db/planUsage";
import { FEATURE_CREDIT_COST } from "@/lib/featureCreditCosts";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_PROMPT_CHARS = 2_000;

function isGeneratedImageUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  const u = url.trim();
  if (!/^https:\/\//i.test(u)) return false;
  if (u.startsWith("/") || u.startsWith("data:") || u.includes("/hero/")) {
    return false;
  }
  return true;
}

type Body = {
  prompt?: string;
  keyword?: string;
  aspectRatio?: string;
  imageSize?: FalImageSizePreset | { width: number; height: number };
  pageIndex?: number;
  pageCount?: number;
  imageStyleId?: string | null;
  moodStyleId?: string | null;
};

/**
 * POST /api/ai-background
 * Atomic multilingual → English Flux prompt (via CommandRouter), then T2I.
 */
export async function POST(req: Request) {
  try {
    if (!hasFalCredentials()) {
      return NextResponse.json(
        {
          ok: false,
          error: "fal_unconfigured",
          message: "FAL_API_KEY / FAL_KEY is not configured on the server.",
        },
        { status: 503 }
      );
    }

    const resolved = await resolveAppUser(req);
    if (!resolved.ok) {
      return NextResponse.json(
        { ok: false, error: resolved.error, message: "Authentication required." },
        { status: resolved.status }
      );
    }
    const userId = resolved.user.id;
    const rl = checkGenerateRateLimit(req, userId);
    if (!rl.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "rate_limited",
          message: "Too many requests. Please try again shortly.",
          resetAt: rl.resetAt,
        },
        { status: 429 }
      );
    }

    const raw = (await req.json().catch(() => null)) as Body | null;
    const promptRaw = sanitizeCommandInput(
      (typeof raw?.prompt === "string" && raw.prompt) ||
        (typeof raw?.keyword === "string" && raw.keyword) ||
        ""
    );

    if (!promptRaw) {
      return NextResponse.json(
        {
          ok: false,
          error: "prompt_required",
          message: "Provide a prompt or keyword for the background.",
        },
        { status: 400 }
      );
    }

    if (promptRaw.length > MAX_PROMPT_CHARS) {
      return NextResponse.json(
        {
          ok: false,
          error: "prompt_too_long",
          message: `Prompt must be ≤ ${MAX_PROMPT_CHARS} characters.`,
        },
        { status: 400 }
      );
    }

    const pageIndex =
      typeof raw?.pageIndex === "number" && Number.isFinite(raw.pageIndex)
        ? Math.max(0, Math.min(9, Math.floor(raw.pageIndex)))
        : 0;
    const pageCount =
      typeof raw?.pageCount === "number" && Number.isFinite(raw.pageCount)
        ? Math.max(1, Math.min(10, Math.floor(raw.pageCount)))
        : 0;

    const imageSize =
      raw?.imageSize ||
      mapAspectToFalImageSize(
        typeof raw?.aspectRatio === "string" ? raw.aspectRatio : undefined
      );

    const pageHint =
      pageCount > 1
        ? ` Unique print face ${pageIndex + 1} of ${pageCount}: different camera angle and layout from every other page, same theme, never a duplicate.`
        : pageIndex > 0
          ? ` (variation ${pageIndex + 1})`
          : "";

    // Atomic multilingual parse — English only for Flux (no prior-request residue).
    const routed = await CommandRouter(
      `${promptRaw}${pageHint}`,
      {
        styleSelection: {
          imageStyleId:
            typeof raw?.imageStyleId === "string" ? raw.imageStyleId : null,
          moodStyleId:
            typeof raw?.moodStyleId === "string" ? raw.moodStyleId : null,
        },
      }
    );
    const falPrompt = applyVisualOnlyPolicy(routed.englishPrompt.trim());

    if (
      !falPrompt ||
      (routed.routerError &&
        !falPrompt &&
        (routed.routerError.code === "gemini_api_key_missing" ||
          routed.routerError.code === "offline_translation_unavailable" ||
          routed.routerError.code === "gemini_json_parse_failed" ||
          routed.routerError.code === "gemini_api_error" ||
          routed.routerError.code === "gemini_empty_english_prompt" ||
          routed.routerError.code === "gemini_english_prompt_contaminated"))
    ) {
      console.error("[ai-background] blocked — no Flux-safe English prompt", {
        requestId: routed.requestId,
        routerError: routed.routerError,
      });
      return NextResponse.json(
        {
          ok: false,
          error: routed.routerError?.code || "gemini_empty_english_prompt",
          message:
            routed.routerError?.message ||
            "Cannot generate background without a safe English Flux prompt. Check GEMINI_API_KEY.",
          requestId: routed.requestId,
          routerError: routed.routerError ?? null,
        },
        { status: 503 }
      );
    }

    if (!isFluxSafeEnglishPrompt(falPrompt)) {
      console.error("[ai-background] blocked — Flux-unsafe prompt", {
        requestId: routed.requestId,
        preview: falPrompt.slice(0, 80),
        language: routed.language,
      });
      return NextResponse.json(
        {
          ok: false,
          error: "gemini_english_prompt_contaminated",
          message:
            "Flux prompt was not safe English (Hangul/CJK or too weak) and was blocked.",
          requestId: routed.requestId,
        },
        { status: 500 }
      );
    }

    const seed =
      (Math.floor(Math.random() * 2_147_483_646) +
        1 +
        pageIndex * 100003 +
        pageCount * 9176) %
      2_147_483_647;

    console.info("[ai-background] atomic fal", {
      requestId: routed.requestId,
      userPrompt: promptRaw,
      language: routed.language,
      falPrompt: falPrompt.slice(0, 200),
      routerError: routed.routerError?.code || null,
      seed,
    });

    const result = await runFalFluxTextToImage({
      prompt: falPrompt,
      image_size: imageSize,
      num_images: 1,
      output_format: "jpeg",
      guidance_scale: 7.5,
      num_inference_steps: 28,
      seed: seed || 1,
    });

    const candidates = [
      result.images[0]?.url,
      ...(result.images.map((i) => i.url) || []),
    ].filter(isGeneratedImageUrl);

    const imageUrl = candidates[0];
    if (!imageUrl) {
      return NextResponse.json(
        {
          ok: false,
          error: "empty_result",
          message:
            "Fal did not return a generated image URL. Check FAL_KEY and try again.",
        },
        { status: 502 }
      );
    }

    const debit = await consumeCreditPool({
      userId,
      amount: FEATURE_CREDIT_COST.aiBackground,
    });
    if (!debit.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "insufficient_quota",
          message: "크레딧이 부족합니다. AI 배경 생성에는 25 크레딧이 필요합니다.",
          amount: FEATURE_CREDIT_COST.aiBackground,
          remaining: debit.remaining,
          usage: snapshotPlanUsage(resolved.user),
        },
        { status: 402 }
      );
    }

    return NextResponse.json({
      ok: true,
      imageUrl,
      prompt: promptRaw,
      falPrompt,
      englishPrompt: falPrompt,
      language: routed.language,
      requestId: routed.requestId,
      images: candidates,
      seed: result.seed ?? seed,
      amount: FEATURE_CREDIT_COST.aiBackground,
      remaining: debit.remaining,
      usage: snapshotPlanUsage(debit.user),
    });
  } catch (error) {
    logFalApiError(error, { stage: "api_ai_background" });
    const message =
      error instanceof Error ? error.message : "AI background generation failed";
    return NextResponse.json(
      {
        ok: false,
        error: "generation_failed",
        message,
      },
      { status: 500 }
    );
  }
}
