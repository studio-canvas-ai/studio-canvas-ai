/**
 * Browser helper: presign → R2 PUT (with progress) → complete.
 */

import {
  DEFAULT_SHORTS_MAX_VIDEO_BYTES,
  isAllowedShortsVideo,
  type ShortsStorageMode,
  type ShortsVideoAsset,
} from "@/lib/shortsVideo";

export type ShortsPresignResponse =
  | {
      ok: true;
      mode: "r2";
      videoId: string;
      key: string;
      contentType: string;
      uploadUrl: string;
      requiredHeaders?: Record<string, string>;
      playbackUrl?: string | null;
      maxBytes?: number;
    }
  | {
      ok: true;
      mode: "local";
      videoId: string;
      key: null;
      contentType: string;
      maxBytes?: number;
      note?: string;
    }
  | { ok?: false; error?: string; maxBytes?: number };

function xhrPutWithProgress(
  url: string,
  file: Blob,
  headers: Record<string, string>,
  onProgress?: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    for (const [k, v] of Object.entries(headers)) {
      xhr.setRequestHeader(k, v);
    }
    xhr.upload.onprogress = (ev) => {
      if (!ev.lengthComputable || !onProgress) return;
      onProgress(Math.min(100, Math.round((ev.loaded / ev.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }
      reject(
        new Error(
          `r2_put_http_${xhr.status}${xhr.responseText ? `:${xhr.responseText.slice(0, 120)}` : ""}`
        )
      );
    };
    xhr.onerror = () =>
      reject(
        new Error(
          "r2_put_network — check R2 CORS allows PUT from this origin"
        )
      );
    xhr.onabort = () => reject(new Error("r2_put_aborted"));
    xhr.send(file);
  });
}

export async function uploadShortsVideoFile(
  file: File,
  opts?: {
    onProgress?: (pct: number) => void;
    signal?: AbortSignal;
  }
): Promise<ShortsVideoAsset> {
  const check = isAllowedShortsVideo(
    file.type,
    file.name,
    file.size,
    DEFAULT_SHORTS_MAX_VIDEO_BYTES
  );
  if (!check.ok) {
    throw new Error(check.error);
  }

  const previewUrl = URL.createObjectURL(file);

  const presignRes = await fetch("/api/shorts/presign", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType: check.contentType,
      sizeBytes: file.size,
    }),
    signal: opts?.signal,
  });

  const presign = (await presignRes.json().catch(() => ({}))) as ShortsPresignResponse;

  if (!presignRes.ok || !presign || !("mode" in presign)) {
    URL.revokeObjectURL(previewUrl);
    const err =
      (presign as { error?: string })?.error ||
      `presign_failed_${presignRes.status}`;
    throw new Error(err);
  }

  if (presign.mode === "local") {
    opts?.onProgress?.(100);
    return {
      videoId: presign.videoId,
      fileName: file.name,
      sizeBytes: file.size,
      contentType: check.contentType,
      previewUrl,
      storageKey: null,
      playbackUrl: null,
      storage: "local" satisfies ShortsStorageMode,
    };
  }

  try {
    opts?.onProgress?.(0);
    await xhrPutWithProgress(
      presign.uploadUrl,
      file,
      {
        "Content-Type": check.contentType,
        ...(presign.requiredHeaders || {}),
      },
      opts?.onProgress
    );

    const completeRes = await fetch("/api/shorts/complete", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoId: presign.videoId,
        key: presign.key,
      }),
      signal: opts?.signal,
    });
    const complete = (await completeRes.json().catch(() => ({}))) as {
      ok?: boolean;
      playbackUrl?: string | null;
      error?: string;
    };

    if (!completeRes.ok || !complete.ok) {
      // Object may still exist; keep local preview and storage key.
      console.warn("[shorts] complete failed:", complete.error);
    }

    return {
      videoId: presign.videoId,
      fileName: file.name,
      sizeBytes: file.size,
      contentType: check.contentType,
      previewUrl,
      storageKey: presign.key,
      playbackUrl: complete.playbackUrl || presign.playbackUrl || null,
      storage: "r2",
    };
  } catch (err) {
    URL.revokeObjectURL(previewUrl);
    throw err;
  }
}
