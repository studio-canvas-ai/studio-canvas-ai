import { NextResponse } from "next/server";
import { resolveAppUser } from "@/lib/resolveAppUser";
import {
  createR2Client,
  getR2Config,
  headR2Object,
  isR2Configured,
} from "@/lib/r2";
import { resolveDownloadUrl } from "@/lib/downloadUrl";
import { isOwnedShortsKey } from "@/lib/shortsVideo";

export const runtime = "nodejs";

/**
 * POST /api/shorts/complete
 * After browser PUT to R2, verify the object and return a playback URL.
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
    if (!isOwnedShortsKey(userId, key) || !key.includes(videoId)) {
      return NextResponse.json({ error: "forbidden_key" }, { status: 403 });
    }

    if (!isR2Configured()) {
      return NextResponse.json({
        ok: true,
        mode: "local" as const,
        videoId,
        key: null,
        playbackUrl: null,
      });
    }

    const config = getR2Config()!;
    const client = createR2Client(config);
    const head = await headR2Object(client, config.bucketName, key);
    if (!head) {
      return NextResponse.json(
        { error: "object_not_found", hint: "Upload may still be in progress or CORS blocked the PUT." },
        { status: 404 }
      );
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
    const message = err instanceof Error ? err.message : "complete_failed";
    console.error("[shorts/complete]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
