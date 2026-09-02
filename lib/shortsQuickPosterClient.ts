"use client";

import { ensureAppSessionFromSupabase } from "@/lib/ensureAppSession";

/**
 * Vercel serverless body limit ≈ 4.5 MB — keep each quick-poster request under 3.8 MB.
 * Samsung moov-at-end: head has first frames, tail has moov index.
 */
const HEAD_BYTES = 1.5 * 1024 * 1024;
const TAIL_BYTES = 2.2 * 1024 * 1024;
const MAX_REQUEST_BYTES = 3.8 * 1024 * 1024;

function readBlobSlice(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(new Error("filereader_empty"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("filereader_failed"));
    reader.readAsArrayBuffer(blob);
  });
}

async function sliceToBlob(file: File, start: number, end: number): Promise<Blob> {
  const slice = file.slice(start, end);
  try {
    const buf = await readBlobSlice(slice);
    return new Blob([buf], { type: "application/octet-stream" });
  } catch {
    return slice;
  }
}

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
 * Sends head+tail in one request when under Vercel body limit; otherwise tail then head.
 */
export async function requestQuickPoster(
  file: File,
  opts?: { signal?: AbortSignal }
): Promise<string | null> {
  await ensureAppSessionFromSupabase();

  const headEnd = Math.min(file.size, HEAD_BYTES);
  const tailStart = Math.max(0, file.size - TAIL_BYTES);
  const headBlob = await sliceToBlob(file, 0, headEnd);
  const tailBlob =
    file.size > HEAD_BYTES
      ? await sliceToBlob(file, tailStart, file.size)
      : null;

  const combined =
    headBlob.size + (tailBlob?.size ?? 0);

  if (tailBlob && combined <= MAX_REQUEST_BYTES) {
    const poster = await postQuickPosterPart(
      { head: headBlob, tail: tailBlob },
      opts?.signal
    );
    if (poster) return poster;
  }

  if (tailBlob) {
    const poster = await postQuickPosterPart({ tail: tailBlob }, opts?.signal);
    if (poster) return poster;
  }

  return postQuickPosterPart({ head: headBlob }, opts?.signal);
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

export { readBlobSlice, HEAD_BYTES, TAIL_BYTES };
