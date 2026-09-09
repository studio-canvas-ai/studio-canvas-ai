import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { resolveAppUser } from "@/lib/resolveAppUser";
import { checkUploadRateLimit } from "@/lib/rateLimit";
import {
  createR2Client,
  getR2Config,
  isR2Configured,
  publicObjectUrl,
  putR2Object,
} from "@/lib/r2";
import { resolveDownloadUrl } from "@/lib/downloadUrl";
import {
  getShortsMaxVideoBytes,
  isAllowedShortsVideo,
  normalizeShortsUploadFile,
  shortsVideoKey,
} from "@/lib/shortsVideo";

export const runtime = "nodejs";
/** Large mobile clips — allow up to ~100MB proxy upload to R2. */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * POST /api/shorts/upload
 * Server-proxy upload: mobile/browser → Vercel → Cloudflare R2 (no client CORS PUT).
 *
 * multipart fields:
 *  - file (required)
 *  - fileName (optional)
 *  - contentType (optional)
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

    const contentTypeHeader = req.headers.get("content-type") || "";
    if (!contentTypeHeader.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "multipart_required" },
        { status: 400 }
      );
    }

    const form = await req.formData();
    const fileEntry = form.get("file");
    if (!fileEntry || !(fileEntry instanceof Blob)) {
      return NextResponse.json({ error: "file_required" }, { status: 400 });
    }

    const nameHint = String(form.get("fileName") ?? "").trim();
    const mimeHint = String(form.get("contentType") ?? "").trim();
    const file = fileEntry as File;

    const normalized = normalizeShortsUploadFile(file);

    const maxBytes = getShortsMaxVideoBytes();
    const check = isAllowedShortsVideo(
      mimeHint || normalized.mime || file.type,
      normalized.fileName,
      file.size,
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
    const key = shortsVideoKey(userId, videoId, normalized.fileName);

    if (!isR2Configured()) {
      return NextResponse.json({
        ok: true,
        mode: "local" as const,
        videoId,
        key: null,
        contentType: check.contentType,
        playbackUrl: null,
        maxBytes,
        fileName: normalized.fileName,
        sizeBytes: file.size,
      });
    }

    const config = getR2Config()!;
    const client = createR2Client(config);
    const bytes = Buffer.from(await file.arrayBuffer());
    await putR2Object(client, config.bucketName, key, bytes, check.contentType);

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
      playbackUrl,
      maxBytes,
      fileName: normalized.fileName,
      sizeBytes: file.size,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "upload_failed";
    console.error("[shorts/upload] R2 Upload Detail Error:", {
      message,
      stack: err instanceof Error ? err.stack : undefined,
      error: err,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
