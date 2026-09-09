import { NextResponse } from "next/server";
import { resolveAppUser } from "@/lib/resolveAppUser";
import { checkUploadRateLimit } from "@/lib/rateLimit";
import { YOUTUBE_STUDIO_UPLOAD_URL } from "@/lib/shortsYoutubeUpload";

export const runtime = "nodejs";

/**
 * POST /api/shorts/youtube/prepare
 * Validates auth and returns YouTube Studio assist metadata.
 * Future: exchange Google OAuth with youtube.upload scope and return resumable session.
 */
export async function POST(req: Request) {
  try {
    const resolved = await resolveAppUser(req);
    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.error, code: "auth" },
        { status: resolved.status }
      );
    }

    const rl = checkUploadRateLimit(req, resolved.user.id);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "rate_limited", resetAt: rl.resetAt },
        { status: 429 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      description?: string;
      hasVideo?: boolean;
      hasThumbnail?: boolean;
      bindThumbIntro?: boolean;
    };

    const title = String(body.title || "Studio Canvas Shorts").slice(0, 100);
    console.info("[shorts/youtube/prepare]", {
      userId: resolved.user.id,
      title,
      hasVideo: Boolean(body.hasVideo),
      hasThumbnail: Boolean(body.hasThumbnail),
      bindThumbIntro: Boolean(body.bindThumbIntro),
    });

    return NextResponse.json({
      ok: true,
      mode: "assist" as const,
      title,
      studioUrl: YOUTUBE_STUDIO_UPLOAD_URL,
      message:
        "Assets will download locally. Complete the upload in YouTube Studio.",
      // Placeholder for future Data API resumable upload
      apiUploadReady: false,
    });
  } catch (err) {
    console.error("[shorts/youtube/prepare]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
