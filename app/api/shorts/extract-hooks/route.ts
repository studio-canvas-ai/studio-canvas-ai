import { NextResponse } from "next/server";
import { resolveAppUser } from "@/lib/resolveAppUser";
import { checkUploadRateLimit } from "@/lib/rateLimit";
import { isOwnedShortsKey } from "@/lib/shortsVideo";
import {
  SHORTS_EXTRACT_MAX_DOWNLOAD_BYTES,
  SHORTS_HOOK_COUNT_MIN,
  downloadShortsVideoFromR2,
  extractHookFramesWithFfmpeg,
  persistHookFramesToR2,
  scoreFrameInterest,
} from "@/lib/shortsHookExtract";
import type { ShortsHookFrame } from "@/lib/shortsHookShared";

export const runtime = "nodejs";
export const maxDuration = 60;

type ScoredBuffer = {
  timestampSec: number;
  buffer: Buffer;
  score: number;
};

/**
 * POST /api/shorts/extract-hooks
 *
 * Body options:
 * 1) JSON `{ videoId, key }` — download from R2 + FFmpeg sample 3–5 hook frames
 * 2) multipart — `videoId`, optional `key`, plus `frame` files (+ optional `timestamps` JSON)
 *    used when R2/local clip is too large or FFmpeg is unavailable
 *
 * Uploads winners to `thumbs/shorts/{userId}/{videoId}/hook-*.webp` when R2 is configured.
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
        { status: 429 }
      );
    }

    const contentType = req.headers.get("content-type") || "";
    let videoId = "";
    let key = "";
    let clientFrames: ScoredBuffer[] = [];
    let preferClient = false;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      videoId = String(form.get("videoId") ?? "").trim();
      key = String(form.get("key") ?? "").trim();
      const timestampsRaw = String(form.get("timestamps") ?? "").trim();
      let timestamps: number[] = [];
      if (timestampsRaw) {
        try {
          const parsed = JSON.parse(timestampsRaw) as unknown;
          if (Array.isArray(parsed)) {
            timestamps = parsed.map((n) => Number(n)).filter((n) => Number.isFinite(n));
          }
        } catch {
          /* ignore */
        }
      }

      const blobs: Blob[] = [];
      for (const [name, value] of form.entries()) {
        if (
          (name === "frame" || name.startsWith("frame")) &&
          value instanceof Blob &&
          value.size > 0
        ) {
          blobs.push(value);
        }
      }

      for (let i = 0; i < blobs.length; i += 1) {
        const buf = Buffer.from(await blobs[i].arrayBuffer());
        const score = await scoreFrameInterest(buf);
        clientFrames.push({
          timestampSec: timestamps[i] ?? i + 1,
          buffer: buf,
          score,
        });
      }
    } else {
      const body = (await req.json().catch(() => null)) as {
        videoId?: string;
        key?: string;
        preferClient?: boolean;
      } | null;
      videoId = String(body?.videoId ?? "").trim();
      key = String(body?.key ?? "").trim();
      preferClient = Boolean(body?.preferClient);
    }

    if (!videoId) {
      return NextResponse.json({ error: "videoId_required" }, { status: 400 });
    }
    if (key && !isOwnedShortsKey(userId, key)) {
      return NextResponse.json({ error: "forbidden_key" }, { status: 403 });
    }
    if (key && !key.includes(videoId)) {
      return NextResponse.json({ error: "forbidden_key" }, { status: 403 });
    }

    let frames: ScoredBuffer[] = [];
    let method: "ffmpeg" | "client_frames" = "client_frames";

    if (clientFrames.length >= SHORTS_HOOK_COUNT_MIN) {
      frames = clientFrames;
      method = "client_frames";
    } else if (!preferClient && key) {
      const downloaded = await downloadShortsVideoFromR2(key);
      if (!downloaded) {
        return NextResponse.json(
          {
            error: "object_not_found",
            preferClient: true,
            hint: "Upload frames from the browser video preview.",
          },
          { status: 404 }
        );
      }
      if (downloaded.size > SHORTS_EXTRACT_MAX_DOWNLOAD_BYTES) {
        return NextResponse.json(
          {
            error: "video_too_large_for_server_extract",
            preferClient: true,
            maxBytes: SHORTS_EXTRACT_MAX_DOWNLOAD_BYTES,
          },
          { status: 413 }
        );
      }
      try {
        frames = await extractHookFramesWithFfmpeg(downloaded.buffer);
        method = "ffmpeg";
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn("[shorts/extract-hooks] ffmpeg failed:", message);
        return NextResponse.json(
          {
            error: "ffmpeg_failed",
            preferClient: true,
            detail: message.slice(0, 200),
          },
          { status: 422 }
        );
      }
    } else {
      return NextResponse.json(
        {
          error: "frames_or_key_required",
          preferClient: true,
        },
        { status: 400 }
      );
    }

    if (frames.length < SHORTS_HOOK_COUNT_MIN) {
      return NextResponse.json(
        { error: "too_few_frames", preferClient: true },
        { status: 422 }
      );
    }

    const hooks: ShortsHookFrame[] = await persistHookFramesToR2({
      userId,
      videoId,
      frames,
    });

    const { consumeCreditPool, snapshotPlanUsage } = await import(
      "@/lib/db/planUsage"
    );
    const { FEATURE_CREDIT_COST } = await import("@/lib/featureCreditCosts");
    const debit = await consumeCreditPool({
      userId,
      amount: FEATURE_CREDIT_COST.shortsHook,
    });
    if (!debit.ok) {
      return NextResponse.json(
        {
          error: "insufficient_quota",
          amount: FEATURE_CREDIT_COST.shortsHook,
          remaining: debit.remaining,
          usage: snapshotPlanUsage(resolved.user),
        },
        { status: 402 }
      );
    }

    return NextResponse.json({
      ok: true,
      videoId,
      method,
      hooks,
      selectedHint: "Pick one frame to continue to the text edit studio.",
      amount: FEATURE_CREDIT_COST.shortsHook,
      remaining: debit.remaining,
      usage: snapshotPlanUsage(debit.user),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "extract_failed";
    console.error("[shorts/extract-hooks]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
