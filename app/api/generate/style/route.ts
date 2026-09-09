import { NextResponse } from "next/server";
import { POST as generatePost } from "@/app/api/generate/route";
import { buildFaceConsistencyPayload } from "@/lib/faceConsistency";
import {
  buildMappedStylePrompt,
  getStylePromptSpec,
  listMappedStyleIds,
  resolveStylePackId,
} from "@/lib/ai/stylePrompts";
import { FAL_FLUX_KONTEXT_PRO, logFalApiError } from "@/lib/ai/fal";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Concept Gallery → Fal Flux Kontext Pro convenience endpoint.
 *
 * Body:
 *   { styleId: string, faceImage: string (data:/https URL),
 *     aspectRatio?: string, prompt?: string, mode?: "initial"|"train" }
 *
 * Maps styleId → prompt dictionary, then reuses /api/generate billing + inference.
 */
export async function POST(req: Request) {
  try {
    const raw = (await req.json()) as {
      styleId?: string;
      style?: string;
      faceImage?: string;
      faceImages?: string[];
      selfieUrls?: string[];
      aspectRatio?: string;
      prompt?: string;
      mode?: "initial" | "train";
    };

    const styleId = resolveStylePackId(raw.styleId || raw.style);
    if (!styleId) {
      return NextResponse.json(
        {
          success: false,
          error: "unknown_style",
          message: `Unknown styleId. Supported: ${listMappedStyleIds().join(", ")} (aliases: travel, cinematic, business, traditional, …)`,
          supportedStyleIds: listMappedStyleIds(),
        },
        { status: 400 }
      );
    }

    const faceImages = [
      ...(Array.isArray(raw.faceImages) ? raw.faceImages : []),
      ...(Array.isArray(raw.selfieUrls) ? raw.selfieUrls : []),
      ...(raw.faceImage ? [raw.faceImage] : []),
    ].filter(
      (u): u is string =>
        typeof u === "string" &&
        u.length > 0 &&
        (u.startsWith("http") || u.startsWith("data:"))
    );

    if (!faceImages.length) {
      return NextResponse.json(
        {
          success: false,
          error: "faceImage_required",
          message:
            "Provide faceImage (or faceImages / selfieUrls) as a data URL or https URL.",
        },
        { status: 400 }
      );
    }

    if (faceImages.some((u) => u.startsWith("blob:"))) {
      return NextResponse.json(
        {
          success: false,
          error: "invalid_image_url",
          message: "blob: URLs are not reachable from the server. Upload as data:/https first.",
        },
        { status: 400 }
      );
    }

    const spec = getStylePromptSpec(styleId);
    const userPrompt = typeof raw.prompt === "string" ? raw.prompt.trim() : "";
    const mappedPrompt = buildMappedStylePrompt({
      styleIds: [styleId],
      userPrompt,
    });

    const payload = buildFaceConsistencyPayload({
      mode: raw.mode === "train" ? "train" : "initial",
      selfieUrls: faceImages.slice(0, 4),
      // User text only — style dictionary is applied inside inference via styleIds.
      prompt: userPrompt,
      aspectRatio: raw.aspectRatio || "9:16",
      styleIds: [styleId],
    });

    const headers = new Headers(req.headers);
    headers.set("content-type", "application/json");

    const inner = new Request(new URL("/api/generate", req.url).toString(), {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const res = await generatePost(inner);
    const data = (await res.json()) as Record<string, unknown>;

    return NextResponse.json(
      {
        ...data,
        styleId,
        styleLabel: spec?.label ?? styleId,
        mappedPrompt,
      },
      { status: res.status }
    );
  } catch (error) {
    logFalApiError(
      (error as { response?: { data?: unknown } })?.response
        ? error
        : { response: { data: error instanceof Error ? error.message : error } },
      { stage: "generate_style_route" }
    );
    console.error("[generate/style]", error);
    return NextResponse.json(
      {
        success: false,
        error: "server_error",
        message: error instanceof Error ? error.message : "unexpected_error",
      },
      { status: 500 }
    );
  }
}

/** List mapped style packs (for admin / client discovery). */
export async function GET() {
  return NextResponse.json({
    success: true,
    model: process.env.FAL_FLUX_MODEL?.trim() || FAL_FLUX_KONTEXT_PRO,
    styles: listMappedStyleIds().map((id) => {
      const spec = getStylePromptSpec(id);
      return {
        id,
        label: spec?.label ?? id,
        promptPreview: (spec?.prompt || "").slice(0, 160) + "…",
      };
    }),
  });
}
