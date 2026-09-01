import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { resolveAppUser } from "@/lib/resolveAppUser";
import { checkUploadRateLimit } from "@/lib/rateLimit";
import {
  createMultipartUpload,
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

const SHORTS_PRESIGN_EXPIRES_SEC = 900;

export const runtime = "nodejs";

/**
 * POST /api/shorts/multipart/init
 * Start R2 multipart upload for large mobile-friendly chunked PUTs.
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
      return NextResponse.json({ error: check.error, maxBytes }, { status });
    }

    if (!isR2Configured()) {
      return NextResponse.json({ error: "r2_not_configured" }, { status: 503 });
    }

    const config = getR2Config()!;
    const bucketName = getR2BucketName();
    if (!bucketName) {
      return NextResponse.json({ error: "r2_bucket_not_configured" }, { status: 500 });
    }

    const videoId = randomUUID();
    const key = shortsVideoKey(userId, videoId, fileName);

    console.info("[shorts/multipart/init] creating upload", {
      bucket: bucketName,
      key,
      endpoint: normalizeR2Endpoint(config),
      sizeBytes,
    });

    const uploadId = await createMultipartUpload(config, key);

    let playbackUrl: string | null = null;
    try {
      const resolvedUrl = await resolveDownloadUrl({ key, expiresInSec: 3600 });
      playbackUrl = resolvedUrl.url;
    } catch {
      playbackUrl = config.publicUrl ? publicObjectUrl(config, key) : null;
    }

    return NextResponse.json({
      ok: true,
      mode: "r2_multipart" as const,
      videoId,
      key,
      uploadId,
      contentType: check.contentType,
      bucket: bucketName,
      playbackUrl,
      maxBytes,
      expiresInSec: SHORTS_PRESIGN_EXPIRES_SEC,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "multipart_init_failed";
    console.error("[shorts/multipart/init]", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
