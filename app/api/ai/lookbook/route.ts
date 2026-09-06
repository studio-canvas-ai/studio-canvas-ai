/**
 * POST /api/ai/lookbook
 * Dedicated FaceID (InstantID / IP-Adapter + ControlNet) pipeline.
 * Server-to-server Fal only; deducts portraitGenerative credits after success.
 * Rejects requests without a face reference — never pure text-to-image.
 */

import { NextResponse } from "next/server";
import { hasFalCredentials, logFalApiError, runFalInstantId } from "@/lib/ai/fal";
import { sanitizeCommandInput } from "@/lib/ai/commandParser";
import { newRequestId } from "@/lib/ai/commandParser";
import {
  buildAtomicLookbookPrompt,
  type LookbookPromptMode,
} from "@/lib/photoLookbookPrompt";
import { checkGenerateRateLimit } from "@/lib/rateLimit";
import { resolveAppUser } from "@/lib/resolveAppUser";
import { consumeCreditPool, snapshotPlanUsage } from "@/lib/db/planUsage";
import { FEATURE_CREDIT_COST } from "@/lib/featureCreditCosts";

export const runtime = "nodejs";
export const maxDuration = 120;

const PORTRAIT_CREDIT = FEATURE_CREDIT_COST.portraitGenerative;

type Body = {
  faceImageUrl?: string;
  prompt?: string;
  mode?: string;
  clientRequestId?: string;
  ipAdapterScale?: number;
};

function unwrapMediaProxy(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("/api/media/fetch?src=")) {
    try {
      return decodeURIComponent(url.split("src=")[1] || "") || url;
    } catch {
      return url;
    }
  }
  return url;
}

function coerceMode(raw: string | undefined): LookbookPromptMode {
  if (raw === "subject_studio" || raw === "subject_edit") return raw;
  return "base_scene";
}

export async function POST(req: Request) {
  try {
    if (!hasFalCredentials()) {
      return NextResponse.json(
        {
          ok: false,
          error: "fal_unconfigured",
          message: "FAL_KEY is not configured.",
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
        { ok: false, error: "rate_limited", resetAt: rl.resetAt },
        { status: 429 }
      );
    }

    const raw = (await req.json().catch(() => null)) as Body | null;
    const faceImageUrl = unwrapMediaProxy(
      typeof raw?.faceImageUrl === "string" ? raw.faceImageUrl.trim() : null
    );
    if (!faceImageUrl) {
      return NextResponse.json(
        {
          ok: false,
          error: "face_required",
          message:
            "Face ID가 없습니다. 학습사진 저장소에서 얼굴을 선택·학습한 뒤 다시 시도해 주세요.",
        },
        { status: 400 }
      );
    }

    const userPrompt = sanitizeCommandInput(
      typeof raw?.prompt === "string" ? raw.prompt : "",
      2_000
    );
    if (!userPrompt) {
      return NextResponse.json(
        {
          ok: false,
          error: "prompt_required",
          message: "장면 설명을 입력해 주세요.",
        },
        { status: 400 }
      );
    }

    const mode = coerceMode(raw?.mode);
    const requestId =
      (typeof raw?.clientRequestId === "string" &&
        raw.clientRequestId.trim().slice(0, 80)) ||
      newRequestId();

    // Fresh prompt every request — no prior outfit/location residue.
    const built = buildAtomicLookbookPrompt({
      userPrompt,
      mode,
      requestId,
    });

    const ipScale =
      typeof raw?.ipAdapterScale === "number" && Number.isFinite(raw.ipAdapterScale)
        ? Math.max(0.85, Math.min(1.2, raw.ipAdapterScale))
        : 0.85;

    console.info("[api/ai/lookbook] start", {
      requestId,
      mode,
      placeMatched: built.placeMatched,
      faceHost: (() => {
        try {
          return new URL(faceImageUrl).host;
        } catch {
          return faceImageUrl.startsWith("data:") ? "data" : "invalid";
        }
      })(),
      promptPreview: built.prompt.slice(0, 140),
    });

    // Server-owned InstantID + IP-Adapter + identity ControlNet — clients cannot
    // weaken face lock below floors (mirrors faceConsistency payload rules).
    const result = await runFalInstantId({
      face_image_url: faceImageUrl,
      prompt: built.prompt,
      negative_prompt: built.negativePrompt,
      ip_adapter_scale: ipScale,
      identity_controlnet_conditioning_scale: 0.85,
      enhance_face_region: true,
      enable_lcm: false,
      num_inference_steps: 28,
      guidance_scale: 4.5,
      style: "(No style)",
    });

    const imageUrl = result.images[0]?.url?.trim();
    if (!imageUrl || !/^https:\/\//i.test(imageUrl)) {
      return NextResponse.json(
        {
          ok: false,
          error: "lookbook_empty",
          message: "화보 생성 결과가 비어 있습니다. 다시 시도해 주세요.",
          requestId,
        },
        { status: 502 }
      );
    }

    const debit = await consumeCreditPool({
      userId,
      amount: PORTRAIT_CREDIT,
    });
    if (!debit.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "insufficient_quota",
          message: `크레딧이 부족합니다. AI 고퀄 인물 생성에는 ${PORTRAIT_CREDIT} 크레딧이 필요합니다.`,
          amount: PORTRAIT_CREDIT,
          remaining: debit.remaining,
          usage: snapshotPlanUsage(resolved.user),
        },
        { status: 402 }
      );
    }

    return NextResponse.json({
      ok: true,
      imageUrl,
      requestId,
      mode,
      falPrompt: built.prompt,
      placeMatched: built.placeMatched,
      amount: PORTRAIT_CREDIT,
      remaining: debit.remaining,
      usage: snapshotPlanUsage(debit.user),
    });
  } catch (error) {
    logFalApiError(error, { stage: "api_ai_lookbook" });
    const message =
      error instanceof Error ? error.message : "Lookbook FaceID pipeline failed";
    const code =
      message === "face_image_url_required"
        ? "face_required"
        : message === "prompt_required"
          ? "prompt_required"
          : "lookbook_failed";
    return NextResponse.json(
      { ok: false, error: code, message },
      { status: code === "face_required" || code === "prompt_required" ? 400 : 500 }
    );
  }
}
