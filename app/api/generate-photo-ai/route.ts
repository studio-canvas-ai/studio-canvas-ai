/**
 * POST /api/generate-photo-ai
 * Screen-26 isolated FaceID pipeline (증명사진 / 화보 / SNS only).
 * Server-to-server Fal InstantID + IP-Adapter + ControlNet.
 * Rejects keep-original mode — that path is rembg-only on the client.
 */

import { NextResponse } from "next/server";
import { hasFalCredentials, logFalApiError, runFalInstantId } from "@/lib/ai/fal";
import {
  newRequestId,
  sanitizeCommandInput,
} from "@/lib/ai/commandParser";
import {
  buildAtomicLookbookPrompt,
} from "@/lib/photoLookbookPrompt";
import {
  isPortraitAiPurposeUse,
  portraitAiPromptLock,
  portraitInstantIdParams,
  PORTRAIT_BODY_SHAPE_LOCK,
  PORTRAIT_BODY_SHAPE_NEGATIVE,
  PORTRAIT_FREE_POSE_NEGATIVE,
  type PortraitAiPurposeUseId,
} from "@/lib/printPortraitPurpose";
import { checkGenerateRateLimit } from "@/lib/rateLimit";
import { resolveAppUser } from "@/lib/resolveAppUser";
import { consumeCreditPool, snapshotPlanUsage } from "@/lib/db/planUsage";
import { FEATURE_CREDIT_COST } from "@/lib/featureCreditCosts";

export const runtime = "nodejs";
export const maxDuration = 120;

const PORTRAIT_CREDIT = FEATURE_CREDIT_COST.portraitGenerative;

/** Hard lock — indoor studio only for every Screen-26 FaceID purpose. */
const STUDIO_BACKGROUND_LOCK =
  "Indoor professional photo studio setting, clean solid color wall backdrop, soft studio lighting, studio portrait, minimalist background, absolutely no outdoor scenery, no nature, no mountains, no landscape";

const STUDIO_NEGATIVE_LOCK =
  "outdoor, outdoors, nature, mountains, landscape, beach, forest, street, park, sky, trees, scenery, environmental background, location plate, travel photo";

type Body = {
  /** Uploaded selfie / identity — https or data URI. */
  imageUrl?: string;
  faceImageUrl?: string;
  /** id-photo | lookbook | sns */
  mode?: string;
  purpose?: string;
  prompt?: string;
  clientRequestId?: string;
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

function coercePurpose(
  raw: string | undefined
): PortraitAiPurposeUseId | null {
  const v = (raw || "").trim();
  if (v === "id-photo-keep-original") return null;
  if (v === "lookbook-keep-original") return null;
  if (v === "sns-keep-original") return null;
  if (isPortraitAiPurposeUse(v)) return v;
  return null;
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
    const purpose = coercePurpose(raw?.mode || raw?.purpose);
    if (!purpose) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_mode",
          message:
            "AI 인물 생성은 증명사진·화보·SNS 용도에서만 사용할 수 있습니다. 원본유지 모드는 누끼·배경 합성만 지원합니다.",
        },
        { status: 400 }
      );
    }

    const faceImageUrl = unwrapMediaProxy(
      (typeof raw?.faceImageUrl === "string" && raw.faceImageUrl.trim()) ||
        (typeof raw?.imageUrl === "string" && raw.imageUrl.trim()) ||
        null
    );
    if (!faceImageUrl) {
      return NextResponse.json(
        {
          ok: false,
          error: "face_required",
          message:
            "사진을 먼저 업로드해 주세요. 얼굴이 보이는 원본 이미지가 필요합니다.",
        },
        { status: 400 }
      );
    }

    if (
      !faceImageUrl.startsWith("data:") &&
      !/^https:\/\//i.test(faceImageUrl)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_image",
          message: "Provide a data URI or https image URL.",
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
          message: "장면·배경 설명을 입력해 주세요.",
        },
        { status: 400 }
      );
    }

    const requestId =
      (typeof raw?.clientRequestId === "string" &&
        raw.clientRequestId.trim().slice(0, 80)) ||
      newRequestId();

    const instantParams = portraitInstantIdParams(purpose);
    const freePose = purpose === "lookbook" || purpose === "sns";

    const lockedPrompt = [
      userPrompt,
      portraitAiPromptLock(purpose),
      STUDIO_BACKGROUND_LOCK,
      PORTRAIT_BODY_SHAPE_LOCK,
    ]
      .filter(Boolean)
      .join(" ");

    const built = buildAtomicLookbookPrompt({
      userPrompt: lockedPrompt,
      // ID: locked studio plate. Lookbook/SNS: generative scene synthesis.
      mode: instantParams.promptMode,
      requestId,
    });

    const falPrompt = [
      built.prompt,
      STUDIO_BACKGROUND_LOCK,
      PORTRAIT_BODY_SHAPE_LOCK,
      freePose
        ? "Generative InstantID synthesis with face preservation — invent pose and wardrobe from the prompt."
        : "",
    ]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    const falNegative = [
      built.negativePrompt,
      STUDIO_NEGATIVE_LOCK,
      PORTRAIT_BODY_SHAPE_NEGATIVE,
      freePose ? PORTRAIT_FREE_POSE_NEGATIVE : "",
    ]
      .filter(Boolean)
      .join(", ")
      .replace(/\s+/g, " ")
      .trim();

    console.info("[api/generate-photo-ai] start", {
      requestId,
      purpose,
      freePose,
      controlnet_selection: instantParams.controlnet_selection ?? null,
      controlnet_conditioning_scale: instantParams.controlnet_conditioning_scale,
      faceHost: (() => {
        try {
          if (faceImageUrl.startsWith("data:")) return "data";
          return new URL(faceImageUrl).host;
        } catch {
          return "invalid";
        }
      })(),
      promptPreview: falPrompt.slice(0, 160),
    });

    const result = await runFalInstantId({
      face_image_url: faceImageUrl,
      prompt: falPrompt,
      negative_prompt: falNegative,
      ip_adapter_scale: instantParams.ip_adapter_scale,
      identity_controlnet_conditioning_scale:
        instantParams.identity_controlnet_conditioning_scale,
      controlnet_conditioning_scale: instantParams.controlnet_conditioning_scale,
      ...(instantParams.controlnet_selection
        ? { controlnet_selection: instantParams.controlnet_selection }
        : {}),
      enhance_face_region: instantParams.enhance_face_region,
      enable_lcm: false,
      num_inference_steps: instantParams.num_inference_steps,
      guidance_scale: instantParams.guidance_scale,
      style: "(No style)",
    });

    const imageUrl = result.images[0]?.url?.trim();
    if (!imageUrl || !/^https:\/\//i.test(imageUrl)) {
      return NextResponse.json(
        {
          ok: false,
          error: "empty_result",
          message: "AI 인물 생성 결과가 비어 있습니다. 다시 시도해 주세요.",
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
          message: `크레딧이 부족합니다. AI 인물 생성에는 ${PORTRAIT_CREDIT} 크레딧이 필요합니다.`,
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
      mode: purpose,
      purpose,
      falPrompt,
      amount: PORTRAIT_CREDIT,
      remaining: debit.remaining,
      usage: snapshotPlanUsage(debit.user),
    });
  } catch (error) {
    logFalApiError(error, { stage: "api_generate_photo_ai" });
    const message =
      error instanceof Error
        ? error.message
        : "Photo AI generation pipeline failed";
    return NextResponse.json(
      { ok: false, error: "generation_failed", message },
      { status: 500 }
    );
  }
}
