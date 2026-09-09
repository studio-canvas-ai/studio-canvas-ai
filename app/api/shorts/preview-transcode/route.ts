import { NextResponse } from "next/server";
import { resolveAppUser } from "@/lib/resolveAppUser";
import { generateMobilePreviewFromR2 } from "@/lib/shortsPreviewTranscode.server";
import { isOwnedShortsKey } from "@/lib/shortsVideo";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

/**
 * POST /api/shorts/preview-transcode
 * After R2 upload: H.264 mobile preview MP4 + poster (HEVC → playable).
 */
export async function POST(req: Request) {
  try {
    const resolved = await resolveAppUser(req);
    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.error },
        { status: resolved.status }
      );
    }
    const userId = resolved.user.id;

    const body = (await req.json().catch(() => null)) as {
      videoId?: string;
      key?: string;
    } | null;

    const videoId = String(body?.videoId ?? "").trim();
    const key = String(body?.key ?? "").trim();
    if (!videoId || !key) {
      return NextResponse.json(
        { error: "videoId and key are required" },
        { status: 400 }
      );
    }
    if (!isOwnedShortsKey(userId, key)) {
      return NextResponse.json({ error: "forbidden_key" }, { status: 403 });
    }

    const result = await generateMobilePreviewFromR2({
      userId,
      videoId,
      sourceKey: key,
    });

    if (!result.playbackUrl && !result.posterDataUrl) {
      return NextResponse.json(
        { ok: false, error: "preview_transcode_failed" },
        { status: 422 }
      );
    }

    return NextResponse.json({
      ok: true,
      cached: result.cached,
      playbackUrl: result.playbackUrl,
      posterDataUrl: result.posterDataUrl,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "preview_transcode_failed";
    console.error("[shorts/preview-transcode]", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
