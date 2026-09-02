import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { resolveAppUser } from "@/lib/resolveAppUser";
import { checkUploadRateLimit } from "@/lib/rateLimit";
import {
  createMultipartUpload,
  getR2BucketName,
  getR2Config,
  isR2Configured,
  publicObjectUrl,
} from "@/lib/r2";
import { resolveDownloadUrl } from "@/lib/downloadUrl";
import {
  getShortsMaxVideoBytes,
  isAllowedShortsVideo,
  isClientVideoId,
  SHORTS_SERVER_CHUNK_BYTES,
  shortsVideoKey,
} from "@/lib/shortsVideo";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * POST /api/shorts/chunk/init
 * Start a server-proxied multipart upload (mobile — no browser→R2 CORS).
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
      videoId?: string;
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

    const requestedId = String(body?.videoId ?? "").trim();
    const videoId =
      requestedId && isClientVideoId(requestedId) ? requestedId : randomUUID();
    const key = shortsVideoKey(userId, videoId, fileName);

    if (!isR2Configured()) {
      return NextResponse.json({
        ok: true,
        mode: "local" as const,
        videoId,
        key: null,
        contentType: check.contentType,
        playbackUrl: null,
        maxBytes,
        chunkBytes: SHORTS_SERVER_CHUNK_BYTES,
      });
    }

    const config = getR2Config()!;
    const bucketName = getR2BucketName();
    if (!bucketName) {
      return NextResponse.json({ error: "r2_bucket_not_configured" }, { status: 500 });
    }

    const uploadId = await createMultipartUpload(config, key);
    const totalChunks = Math.max(1, Math.ceil(sizeBytes / SHORTS_SERVER_CHUNK_BYTES));

    let playbackUrl: string | null = null;
    try {
      const resolvedUrl = await resolveDownloadUrl({ key, expiresInSec: 3600 });
      playbackUrl = resolvedUrl.url;
    } catch {
      playbackUrl = config.publicUrl ? publicObjectUrl(config, key) : null;
    }

    return NextResponse.json({
      ok: true,
      mode: "server_chunk" as const,
      videoId,
      key,
      uploadId,
      contentType: check.contentType,
      bucket: bucketName,
      playbackUrl,
      maxBytes,
      chunkBytes: SHORTS_SERVER_CHUNK_BYTES,
      totalChunks,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "chunk_init_failed";
    console.error("[shorts/chunk/init]", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
