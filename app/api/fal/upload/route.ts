import { NextResponse } from "next/server";
import {
  ensureFalHttpsImageUrl,
  hasFalCredentials,
  logFalApiError,
} from "@/lib/ai/fal";
import { checkGenerateRateLimit } from "@/lib/rateLimit";
import { resolveAppUser } from "@/lib/resolveAppUser";

export const runtime = "nodejs";
export const maxDuration = 60;

/** ~3.2MB JSON ceiling — stay under Vercel’s ~4.5MB body limit. */
const MAX_BODY_BYTES = 3_200_000;
/** Single data-URI character budget (~2.4MB binary after base64). */
const MAX_DATA_URI_CHARS = 3_200_000;

/**
 * Upload one face/reference image to Fal CDN.
 * Body: { image: string } — https URL (passthrough) or data:image/…;base64,…
 * Returns: { ok: true, url: "https://…" }
 */
export async function POST(req: Request) {
  try {
    const contentLength = Number(req.headers.get("content-length") || "0");
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          error: "payload_too_large",
          message:
            "Image payload exceeds the upload limit. Compress the photo and try again.",
        },
        { status: 413 }
      );
    }

    if (!hasFalCredentials()) {
      return NextResponse.json(
        {
          ok: false,
          error: "fal_unconfigured",
          message: "FAL_KEY is not configured on the server.",
        },
        { status: 503 }
      );
    }

    const resolved = await resolveAppUser(req);
    const userId = resolved.ok ? resolved.user.id : null;
    const rl = checkGenerateRateLimit(req, userId);
    if (!rl.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "rate_limited",
          message: "Too many upload requests. Please try again shortly.",
          resetAt: rl.resetAt,
        },
        { status: 429 }
      );
    }

    let raw: { image?: string; imageUrl?: string };
    try {
      raw = (await req.json()) as { image?: string; imageUrl?: string };
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_json",
          message: "Request body must be JSON with an image field.",
        },
        { status: 400 }
      );
    }

    const image =
      (typeof raw.image === "string" && raw.image.trim()) ||
      (typeof raw.imageUrl === "string" && raw.imageUrl.trim()) ||
      "";

    if (!image) {
      return NextResponse.json(
        {
          ok: false,
          error: "image_required",
          message: "Provide image (data URI or https URL).",
        },
        { status: 400 }
      );
    }

    if (image.startsWith("blob:")) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_image_url",
          message: "blob: URLs cannot be uploaded from the server.",
        },
        { status: 400 }
      );
    }

    if (image.startsWith("data:") && image.length > MAX_DATA_URI_CHARS) {
      return NextResponse.json(
        {
          ok: false,
          error: "payload_too_large",
          message:
            "Image data URI is too large. Compress to ≤1024px JPEG before upload.",
        },
        { status: 413 }
      );
    }

    // Already on Fal CDN — no re-upload.
    if (
      /^https:\/\//i.test(image) &&
      (image.includes("fal.media") || image.includes("fal.ai"))
    ) {
      return NextResponse.json({ ok: true, url: image });
    }

    const url = await ensureFalHttpsImageUrl(image);
    return NextResponse.json({ ok: true, url });
  } catch (error) {
    logFalApiError(
      (error as { response?: { data?: unknown } })?.response
        ? error
        : { response: { data: error instanceof Error ? error.message : error } },
      { stage: "api_fal_upload" }
    );
    return NextResponse.json(
      {
        ok: false,
        error: "upload_failed",
        message: error instanceof Error ? error.message : "upload_failed",
      },
      { status: 500 }
    );
  }
}
