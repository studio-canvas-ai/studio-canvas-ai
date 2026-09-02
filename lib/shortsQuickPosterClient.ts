"use client";

/** Head + tail bytes for server FFmpeg (moov-at-end MP4 on Samsung). */
const HEAD_BYTES = 2 * 1024 * 1024;
const TAIL_BYTES = 2 * 1024 * 1024;

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

/**
 * Fast server poster from file fragments — no full upload, no WASM OOM.
 */
export async function requestQuickPoster(
  file: File,
  opts?: { signal?: AbortSignal }
): Promise<string | null> {
  const headEnd = Math.min(file.size, HEAD_BYTES);
  const tailStart = Math.max(0, file.size - TAIL_BYTES);

  const fd = new FormData();
  fd.append("head", file.slice(0, headEnd), "head.mp4");
  if (file.size > HEAD_BYTES) {
    fd.append("tail", file.slice(tailStart, file.size), "tail.mp4");
  }

  const res = await fetch("/api/shorts/quick-poster", {
    method: "POST",
    credentials: "same-origin",
    body: fd,
    signal: opts?.signal,
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
