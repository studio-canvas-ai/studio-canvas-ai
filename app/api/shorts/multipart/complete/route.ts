import { NextResponse } from "next/server";
import { resolveAppUser } from "@/lib/resolveAppUser";
import {
  completeMultipartUpload,
  createR2Client,
  getR2Config,
  headR2Object,
  isR2Configured,
} from "@/lib/r2";
import { resolveDownloadUrl } from "@/lib/downloadUrl";
import { isOwnedShortsKey } from "@/lib/shortsVideo";

export const runtime = "nodejs";

type PartRow = { partNumber?: number; etag?: string };

/**
 * POST /api/shorts/multipart/complete
 * Finalize multipart upload on R2 and return playback URL.
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
      uploadId?: string;
      parts?: PartRow[];
    } | null;

    const videoId = String(body?.videoId ?? "").trim();
    const key = String(body?.key ?? "").trim();
    const uploadId = String(body?.uploadId ?? "").trim();
    const parts = Array.isArray(body?.parts) ? body!.parts! : [];

    if (!videoId || !key || !uploadId || parts.length === 0) {
      return NextResponse.json(
        { error: "videoId, key, uploadId, and parts are required" },
        { status: 400 }
      );
    }
    if (!isOwnedShortsKey(userId, key) || !key.includes(videoId)) {
      return NextResponse.json({ error: "forbidden_key" }, { status: 403 });
    }

    const normalized = parts
      .map((p) => ({
        partNumber: Number(p.partNumber),
        etag: String(p.etag ?? "").trim(),
      }))
      .filter((p) => Number.isInteger(p.partNumber) && p.partNumber > 0 && p.etag);

    if (normalized.length !== parts.length) {
      return NextResponse.json({ error: "invalid_parts" }, { status: 400 });
    }

    if (!isR2Configured()) {
      return NextResponse.json({ error: "r2_not_configured" }, { status: 503 });
    }

    const config = getR2Config()!;
    await completeMultipartUpload(config, key, uploadId, normalized);

    const client = createR2Client(config);
    const head = await headR2Object(client, config.bucketName, key);
    if (!head) {
      return NextResponse.json({ error: "object_not_found" }, { status: 404 });
    }

    const { url: playbackUrl } = await resolveDownloadUrl({
      key,
      expiresInSec: 3600,
    });

    return NextResponse.json({
      ok: true,
      mode: "r2" as const,
      videoId,
      key,
      playbackUrl,
      sizeBytes: head.contentLength ?? null,
      contentType: head.contentType ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "multipart_complete_failed";
    console.error("[shorts/multipart/complete]", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
