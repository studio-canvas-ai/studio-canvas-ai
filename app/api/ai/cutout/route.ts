import { NextResponse } from "next/server";
import { hasFalCredentials, logFalApiError } from "@/lib/ai/fal";
import { ImageProcessor } from "@/lib/ai/imageProcessor";
import { checkGenerateRateLimit } from "@/lib/rateLimit";
import { resolveAppUser } from "@/lib/resolveAppUser";

export const runtime = "nodejs";
export const maxDuration = 120;

type Body = {
  image?: string;
  imageUrl?: string;
};

/**
 * POST /api/ai/cutout
 * Body: { image | imageUrl } — data URI or https
 * Returns transparent PNG cutout for subjectLayer.
 */
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
    const userId = resolved.ok ? resolved.user.id : null;
    const rl = checkGenerateRateLimit(req, userId);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "rate_limited", resetAt: rl.resetAt },
        { status: 429 }
      );
    }

    const raw = (await req.json().catch(() => null)) as Body | null;
    const image =
      (typeof raw?.image === "string" && raw.image.trim()) ||
      (typeof raw?.imageUrl === "string" && raw.imageUrl.trim()) ||
      "";

    if (!image) {
      return NextResponse.json(
        { ok: false, error: "image_required", message: "image or imageUrl required" },
        { status: 400 }
      );
    }

    if (
      !image.startsWith("data:") &&
      !image.startsWith("https://") &&
      !image.startsWith("http://")
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_image",
          message: "Provide a data URI or http(s) image URL.",
        },
        { status: 400 }
      );
    }

    const { cutoutUrl, requestId } = await ImageProcessor(image);

    return NextResponse.json({
      ok: true,
      imageUrl: cutoutUrl,
      cutoutUrl,
      requestId: requestId ?? null,
    });
  } catch (error) {
    logFalApiError(error, { stage: "api_ai_cutout" });
    return NextResponse.json(
      {
        ok: false,
        error: "cutout_failed",
        message:
          error instanceof Error ? error.message : "Background removal failed",
      },
      { status: 500 }
    );
  }
}
