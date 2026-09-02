"use client";

import { ensureAppSessionFromSupabase } from "@/lib/ensureAppSession";

/**
 * Vercel serverless body limit ≈ 4.5 MB — keep each quick-poster request under 3.8 MB.
 * Samsung moov-at-end: head has first frames, tail has moov index.
 */
const HEAD_BYTES = 1.5 * 1024 * 1024;
const TAIL_BYTES = 2.2 * 1024 * 1024;
const MAX_REQUEST_BYTES = 3.8 * 1024 * 1024;

async function postQuickPosterPart(
  parts: { head?: Blob; tail?: Blob },
  signal?: AbortSignal
): Promise<string | null> {
  const fd = new FormData();
  if (parts.head) fd.append("head", parts.head, "head.mp4");
  if (parts.tail) fd.append("tail", parts.tail, "tail.mp4");

  const res = await fetch("/api/shorts/quick-poster", {
    method: "POST",
    credentials: "same-origin",
    body: fd,
    signal,
  });

  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    posterDataUrl?: string;
    error?: string;
  };

  if (!res.ok || !json.ok || !json.posterDataUrl) {
    console.warn("[shorts/quick-poster] failed", json.error || res.status);
    return null;
  }

  return json.posterDataUrl;
}

/**
 * Fast server poster from file fragments — no full upload, no WASM OOM.
 * Tail-first for ~1s poster on Samsung moov-at-end HEVC; then head, then combined.
 */
export async function requestQuickPoster(
  file: File,
  opts?: { signal?: AbortSignal }
): Promise<string | null> {
  // Do not block on session bridge — upload must stay priority on mobile LTE.
  void ensureAppSessionFromSupabase().catch(() => undefined);

  const headEnd = Math.min(file.size, HEAD_BYTES);
  const tailStart = Math.max(0, file.size - TAIL_BYTES);
  // Never FileReader the gallery File before upload finishes — breaks Android XHR PUT.
  const headBlob = file.slice(0, headEnd);
  const tailBlob = file.size > HEAD_BYTES ? file.slice(tailStart, file.size) : null;

  if (tailBlob) {
    const tailPoster = await postQuickPosterPart({ tail: tailBlob }, opts?.signal);
    if (tailPoster) return tailPoster;
  }

  const headPoster = await postQuickPosterPart({ head: headBlob }, opts?.signal);
  if (headPoster) return headPoster;

  if (tailBlob && headBlob.size + tailBlob.size <= MAX_REQUEST_BYTES) {
    return postQuickPosterPart({ head: headBlob, tail: tailBlob }, opts?.signal);
  }

  return null;
}

export async function requestPreviewTranscode(payload: {
  videoId: string;
  key: string;
  signal?: AbortSignal;
}): Promise<{ playbackUrl: string | null; posterDataUrl: string | null }> {
  const res = await fetch("/api/shorts/preview-transcode", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      videoId: payload.videoId,
      key: payload.key,
    }),
    signal: payload.signal,
  });

  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    playbackUrl?: string | null;
    posterDataUrl?: string | null;
    error?: string;
  };

  if (!res.ok || !json.ok) {
    console.warn("[shorts/preview-transcode] failed", json.error || res.status);
    return { playbackUrl: null, posterDataUrl: null };
  }

  return {
    playbackUrl: json.playbackUrl ?? null,
    posterDataUrl: json.posterDataUrl ?? null,
  };
}

export { HEAD_BYTES, TAIL_BYTES };
