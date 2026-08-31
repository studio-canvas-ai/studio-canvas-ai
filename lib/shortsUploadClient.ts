/**
 * Browser helper: presign → R2 PUT (with progress) → complete.
 */

import {
  DEFAULT_SHORTS_MAX_VIDEO_BYTES,
  isAllowedShortsVideo,
  normalizeShortsUploadFile,
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

export type ShortsUploadErrorStage = "validate" | "presign" | "r2_put" | "complete";

export class ShortsUploadError extends Error {
  stage: ShortsUploadErrorStage;
  details: Record<string, unknown>;

  constructor(
    stage: ShortsUploadErrorStage,
    message: string,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "ShortsUploadError";
    this.stage = stage;
    this.details = details;
  }
}

function safeUploadUrlHost(uploadUrl: string): string {
  try {
    return new URL(uploadUrl).host;
  } catch {
    return "(invalid-url)";
  }
}

function buildPutHeaders(
  presign: Extract<ShortsPresignResponse, { mode: "r2" }>
): Record<string, string> {
  const contentType =
    presign.contentType?.trim() ||
    presign.requiredHeaders?.["Content-Type"]?.trim() ||
    "";
  if (!contentType) {
    throw new ShortsUploadError("r2_put", "missing_content_type", {
      presignContentType: presign.contentType,
      requiredHeaders: presign.requiredHeaders ?? null,
    });
  }
  // Single Content-Type only — must match presign response (not double-set from client sniff).
  return { "Content-Type": contentType };
}

function xhrPutWithProgress(
  url: string,
  file: Blob,
  headers: Record<string, string>,
  onProgress?: (pct: number) => void
): Promise<{ status: number; responseText: string; responseHeaders: string }> {
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
      const responseHeaders = xhr.getAllResponseHeaders?.() ?? "";
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve({
          status: xhr.status,
          responseText: xhr.responseText ?? "",
          responseHeaders,
        });
        return;
      }
      reject(
        new ShortsUploadError(
          "r2_put",
          `r2_put_http_${xhr.status}`,
          {
            httpStatus: xhr.status,
            responseText: (xhr.responseText ?? "").slice(0, 2000),
            responseHeaders,
            requestHeaders: headers,
            uploadHost: safeUploadUrlHost(url),
            blobSize: file.size,
            blobType: file.type || null,
          }
        )
      );
    };
    xhr.onerror = () =>
      reject(
        new ShortsUploadError(
          "r2_put",
          "r2_put_network",
          {
            hint: "Check R2 bucket CORS allows PUT from this origin with Content-Type header",
            requestHeaders: headers,
            uploadHost: safeUploadUrlHost(url),
            blobSize: file.size,
            blobType: file.type || null,
          }
        )
      );
    xhr.onabort = () =>
      reject(new ShortsUploadError("r2_put", "r2_put_aborted", {}));
    xhr.send(file);
  });
}

export function logR2UploadDetailError(
  err: unknown,
  context?: Record<string, unknown>
): void {
  const base =
    err instanceof ShortsUploadError
      ? {
          name: err.name,
          stage: err.stage,
          message: err.message,
          ...err.details,
        }
      : err instanceof Error
        ? { name: err.name, message: err.message, stack: err.stack }
        : { value: String(err) };

  console.error("R2 Upload Detail Error:", { ...base, ...context });
}

export async function uploadShortsVideoFile(
  file: File,
  opts?: {
    onProgress?: (pct: number) => void;
    signal?: AbortSignal;
  }
): Promise<ShortsVideoAsset> {
  const normalized = normalizeShortsUploadFile(file);
  const check = isAllowedShortsVideo(
    normalized.mime,
    normalized.fileName,
    normalized.sizeBytes,
    DEFAULT_SHORTS_MAX_VIDEO_BYTES
  );

  if (!check.ok) {
    const err = new ShortsUploadError("validate", check.error, {
      rawFileName: file.name,
      normalizedFileName: normalized.fileName,
      rawMime: file.type || null,
      normalizedMime: normalized.mime,
      sizeBytes: normalized.sizeBytes,
      maxBytes: DEFAULT_SHORTS_MAX_VIDEO_BYTES,
    });
    logR2UploadDetailError(err);
    throw err;
  }

  const previewUrl = URL.createObjectURL(file);

  let presignRes: Response;
  try {
    presignRes = await fetch("/api/shorts/presign", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: normalized.fileName,
        contentType: check.contentType,
        sizeBytes: normalized.sizeBytes,
      }),
      signal: opts?.signal,
    });
  } catch (fetchErr) {
    URL.revokeObjectURL(previewUrl);
    const err = new ShortsUploadError("presign", "presign_network", {
      cause:
        fetchErr instanceof Error
          ? { message: fetchErr.message, name: fetchErr.name }
          : String(fetchErr),
    });
    logR2UploadDetailError(err);
    throw err;
  }

  const presignRaw = await presignRes.text();
  let presign: ShortsPresignResponse;
  try {
    presign = JSON.parse(presignRaw) as ShortsPresignResponse;
  } catch {
    presign = {};
  }

  if (!presignRes.ok || !presign || !("mode" in presign)) {
    URL.revokeObjectURL(previewUrl);
    const err = new ShortsUploadError(
      "presign",
      (presign as { error?: string })?.error ||
        `presign_failed_${presignRes.status}`,
      {
        httpStatus: presignRes.status,
        responseBody: presignRaw.slice(0, 2000),
        request: {
          fileName: normalized.fileName,
          contentType: check.contentType,
          sizeBytes: normalized.sizeBytes,
        },
      }
    );
    logR2UploadDetailError(err);
    throw err;
  }

  if (presign.mode === "local") {
    opts?.onProgress?.(100);
    return {
      videoId: presign.videoId,
      fileName: normalized.fileName,
      sizeBytes: normalized.sizeBytes,
      contentType: check.contentType,
      previewUrl,
      storageKey: null,
      playbackUrl: null,
      storage: "local" satisfies ShortsStorageMode,
    };
  }

  const putHeaders = buildPutHeaders(presign);

  console.info("[shorts/r2] PUT starting", {
    uploadHost: safeUploadUrlHost(presign.uploadUrl),
    contentType: putHeaders["Content-Type"],
    presignContentType: presign.contentType,
    requiredHeaders: presign.requiredHeaders ?? null,
    clientValidatedContentType: check.contentType,
    sizeBytes: normalized.sizeBytes,
    fileName: normalized.fileName,
    rawMime: file.type || null,
  });

  try {
    opts?.onProgress?.(0);
    const putResult = await xhrPutWithProgress(
      presign.uploadUrl,
      file,
      putHeaders,
      opts?.onProgress
    );

    console.info("[shorts/r2] PUT ok", {
      httpStatus: putResult.status,
      uploadHost: safeUploadUrlHost(presign.uploadUrl),
    });

    let completeRes: Response;
    try {
      completeRes = await fetch("/api/shorts/complete", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: presign.videoId,
          key: presign.key,
        }),
        signal: opts?.signal,
      });
    } catch (completeFetchErr) {
      console.warn("[shorts/r2] complete network error (object may exist on R2)", {
        cause:
          completeFetchErr instanceof Error
            ? completeFetchErr.message
            : String(completeFetchErr),
        videoId: presign.videoId,
        key: presign.key,
      });
      return {
        videoId: presign.videoId,
        fileName: normalized.fileName,
        sizeBytes: normalized.sizeBytes,
        contentType: check.contentType,
        previewUrl,
        storageKey: presign.key,
        playbackUrl: presign.playbackUrl || null,
        storage: "r2",
      };
    }

    const completeRaw = await completeRes.text();
    let complete: { ok?: boolean; playbackUrl?: string | null; error?: string };
    try {
      complete = JSON.parse(completeRaw) as typeof complete;
    } catch {
      complete = {};
    }

    if (!completeRes.ok || !complete.ok) {
      const err = new ShortsUploadError(
        "complete",
        complete.error || `complete_failed_${completeRes.status}`,
        {
          httpStatus: completeRes.status,
          responseBody: completeRaw.slice(0, 2000),
          videoId: presign.videoId,
          key: presign.key,
          note: "R2 PUT may have succeeded; verify bucket object and CORS if playback fails.",
        }
      );
      logR2UploadDetailError(err);
      // Keep local preview — object may exist on R2.
    }

    return {
      videoId: presign.videoId,
      fileName: normalized.fileName,
      sizeBytes: normalized.sizeBytes,
      contentType: check.contentType,
      previewUrl,
      storageKey: presign.key,
      playbackUrl: complete.playbackUrl || presign.playbackUrl || null,
      storage: "r2",
    };
  } catch (err) {
    URL.revokeObjectURL(previewUrl);
    logR2UploadDetailError(err, {
      fileName: normalized.fileName,
      contentType: check.contentType,
      putHeaders,
      sizeBytes: normalized.sizeBytes,
    });
    throw err;
  }
}
