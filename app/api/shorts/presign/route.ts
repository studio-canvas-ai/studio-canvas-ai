import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { resolveAppUser } from "@/lib/resolveAppUser";
import { checkUploadRateLimit } from "@/lib/rateLimit";
import {
  createSignedPutUrl,
  getR2BucketName,
  getR2Config,
  isR2Configured,
  normalizeR2Endpoint,
  publicObjectUrl,
} from "@/lib/r2";
import { resolveDownloadUrl } from "@/lib/downloadUrl";
import {
  getShortsMaxVideoBytes,
  isAllowedShortsVideo,
  shortsVideoKey,
} from "@/lib/shortsVideo";

/** Presigned PUT URL lifetime (15 min — well above mobile 5 min minimum). */
export const SHORTS_PRESIGN_EXPIRES_SEC = 900;

export const runtime = "nodejs";

/**
 * POST /api/shorts/presign
 * Issue a Cloudflare R2 presigned PUT URL for Shorts video upload.
 * When R2 is not configured, returns mode:"local" so the client keeps a blob preview.
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

    const rl = checkUploadRateLimit(req, userId);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "rate_limited", resetAt: rl.resetAt },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          },
        }
      );
    }

    const body = (await req.json().catch(() => null)) as {
      fileName?: string;
      contentType?: string;
      sizeBytes?: number;
    } | null;

    const fileName = String(body?.fileName ?? "").trim() || "shorts.mp4";
    const sizeBytes = Number(body?.sizeBytes ?? 0);
    const maxBytes = getShortsMaxVideoBytes();
    const check = isAllowedShortsVideo(
      body?.contentType,
      fileName,
      sizeBytes,
      maxBytes
    );
    if (!check.ok) {
      const status =
        check.error === "file_too_large"
          ? 413
          : check.error === "unsupported_type"
            ? 415
            : 400;
      return NextResponse.json(
        { error: check.error, maxBytes },
        { status }
      );
    }

    const videoId = randomUUID();
    const key = shortsVideoKey(userId, videoId, fileName);

    if (!isR2Configured()) {
      return NextResponse.json({
        ok: true,
        mode: "local" as const,
        videoId,
        key: null,
        contentType: check.contentType,
        maxBytes,
        note: "R2 not configured — preview stays local until cloud storage is set.",
      });
    }

    const config = getR2Config()!;
    const bucketName = getR2BucketName();
    if (!bucketName) {
      return NextResponse.json({ error: "r2_bucket_not_configured" }, { status: 500 });
    }

    console.info("[shorts/presign] issuing presigned PUT", {
      bucket: bucketName,
      key,
      contentType: check.contentType,
      endpoint: normalizeR2Endpoint(config),
    });

    const uploadUrl = await createSignedPutUrl(
      config,
      key,
      check.contentType,
      SHORTS_PRESIGN_EXPIRES_SEC
    );

    let playbackUrl: string | null = null;
    try {
      const resolvedUrl = await resolveDownloadUrl({ key, expiresInSec: 3600 });
      playbackUrl = resolvedUrl.url;
    } catch {
      playbackUrl = config.publicUrl ? publicObjectUrl(config, key) : null;
    }

    return NextResponse.json({
      ok: true,
      mode: "r2" as const,
      videoId,
      key,
      contentType: check.contentType,
      uploadUrl,
      /** Metadata hint only — browser PUT must not send Content-Type (avoids mobile CORS preflight). */
      putContentType: check.contentType,
      requiredHeaders: {},
      bucket: bucketName,
      playbackUrl,
      maxBytes,
      expiresInSec: SHORTS_PRESIGN_EXPIRES_SEC,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "presign_failed";
    console.error("[shorts/presign] R2 Upload Detail Error:", {
      message,
      stack: err instanceof Error ? err.stack : undefined,
      error: err,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
