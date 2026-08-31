/**
 * Browser helper: presign → R2 PUT (with progress) → complete.
 * Large clips bypass Vercel's 4.5 MB function body limit via direct R2 upload.
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
      playbackUrl?: string | null;
      maxBytes?: number;
      note?: string;
    }
  | { ok?: false; error?: string; maxBytes?: number };

export type ShortsUploadErrorStage =
  | "validate"
  | "presign"
  | "r2_put"
  | "complete";

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

function uploadHostFromUrl(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/** Direct PUT to R2 — only Content-Type + raw file body (no cookies/extra headers). */
function xhrPutWithProgress(
  url: string,
  file: Blob,
  contentType: string,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);

    const onAbort = () => xhr.abort();
    if (signal) {
      if (signal.aborted) {
        reject(new ShortsUploadError("r2_put", "r2_put_aborted", {}));
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }

    xhr.setRequestHeader("Content-Type", contentType);

    xhr.upload.onprogress = (ev) => {
      if (!ev.lengthComputable || !onProgress) return;
      onProgress(Math.min(100, Math.round((ev.loaded / ev.total) * 100)));
    };
    xhr.onload = () => {
      if (signal) signal.removeEventListener("abort", onAbort);
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }
      reject(
        new ShortsUploadError("r2_put", `r2_put_http_${xhr.status}`, {
          httpStatus: xhr.status,
          responseText: (xhr.responseText ?? "").slice(0, 2000),
          uploadHost: uploadHostFromUrl(url),
          blobSize: file.size,
        })
      );
    };
    xhr.onerror = () => {
      if (signal) signal.removeEventListener("abort", onAbort);
      reject(
        new ShortsUploadError("r2_put", "r2_put_network", {
          hint: "Network error during R2 PUT — verify bucket CORS allows PUT from this site",
          uploadHost: uploadHostFromUrl(url),
          blobSize: file.size,
        })
      );
    };
    xhr.onabort = () => {
      if (signal) signal.removeEventListener("abort", onAbort);
      reject(new ShortsUploadError("r2_put", "r2_put_aborted", {}));
    };
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

function detailToText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Error) return value.message || value.name;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function compactResponseSnippet(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const code = trimmed.match(/<Code>([^<]+)<\/Code>/i)?.[1];
  const message = trimmed.match(/<Message>([^<]+)<\/Message>/i)?.[1];
  if (code || message) {
    return [code, message].filter(Boolean).join(": ");
  }
  try {
    const parsed = JSON.parse(trimmed) as { error?: string; message?: string };
    if (parsed.error || parsed.message) {
      return [parsed.error, parsed.message].filter(Boolean).join(": ");
    }
  } catch {
    /* plain text / XML */
  }
  return trimmed.length > 480 ? `${trimmed.slice(0, 480)}…` : trimmed;
}

/** User-visible upload failure copy — actual server/network cause, not a fixed R2 banner. */
export function formatShortsUploadErrorForDisplay(err: unknown): string {
  if (err instanceof ShortsUploadError) {
    const lines: string[] = [`[${err.stage}] ${err.message}`];
    const d = err.details;

    if (typeof d.httpStatus === "number") {
      lines.push(`HTTP ${d.httpStatus}`);
    }
    if (typeof d.hint === "string" && d.hint.trim()) {
      lines.push(d.hint.trim());
    }

    const responseSnippet =
      typeof d.responseBody === "string"
        ? compactResponseSnippet(d.responseBody)
        : typeof d.responseText === "string"
          ? compactResponseSnippet(d.responseText)
          : "";
    if (responseSnippet) lines.push(responseSnippet);

    if (d.cause != null) {
      const cause = detailToText(d.cause);
      if (cause) lines.push(cause);
    }

    if (err.stage === "validate") {
      const meta = [
        d.rawFileName != null ? `file=${detailToText(d.rawFileName)}` : null,
        d.rawMime != null ? `mime=${detailToText(d.rawMime)}` : null,
        d.sizeBytes != null ? `size=${detailToText(d.sizeBytes)}` : null,
        d.maxBytes != null ? `max=${detailToText(d.maxBytes)}` : null,
      ].filter(Boolean);
      if (meta.length) lines.push(meta.join(" · "));
    }

    if (typeof d.uploadHost === "string" && d.uploadHost) {
      lines.push(`host=${d.uploadHost}`);
    }
    if (typeof d.uploadPath === "string" && d.uploadPath) {
      lines.push(`path=${d.uploadPath}`);
    }
    if (typeof d.note === "string" && d.note.trim()) {
      lines.push(d.note.trim());
    }

    return lines.join("\n");
  }

  if (err instanceof Error) {
    return err.message?.trim() || err.name || "upload_failed";
  }

  return String(err);
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

  console.info("[shorts/upload] POST /api/shorts/presign", {
    fileName: normalized.fileName,
    contentType: check.contentType,
    sizeBytes: normalized.sizeBytes,
  });

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
  } catch (cause) {
    const err = new ShortsUploadError("presign", "presign_network", {
      cause,
      uploadPath: "/api/shorts/presign",
    });
    logR2UploadDetailError(err, {
      fileName: normalized.fileName,
      contentType: check.contentType,
      sizeBytes: normalized.sizeBytes,
    });
    URL.revokeObjectURL(previewUrl);
    throw err;
  }

  let presign: ShortsPresignResponse;
  try {
    presign = (await presignRes.json()) as ShortsPresignResponse;
  } catch {
    presign = {};
  }

  if (!presignRes.ok || !presign || !("mode" in presign)) {
    const err = new ShortsUploadError(
      "presign",
      (presign as { error?: string })?.error ||
        `presign_failed_${presignRes.status}`,
      {
        httpStatus: presignRes.status,
        responseBody: JSON.stringify(presign).slice(0, 2000),
        uploadPath: "/api/shorts/presign",
      }
    );
    logR2UploadDetailError(err);
    URL.revokeObjectURL(previewUrl);
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
      playbackUrl: presign.playbackUrl ?? null,
      storage: "local" satisfies ShortsStorageMode,
    };
  }

  const putContentType = presign.contentType || check.contentType;

  try {
    opts?.onProgress?.(0);
    await xhrPutWithProgress(
      presign.uploadUrl,
      file,
      putContentType,
      opts?.onProgress,
      opts?.signal
    );

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
    } catch (cause) {
      console.warn("[shorts/upload] complete network failed:", cause);
      return {
        videoId: presign.videoId,
        fileName: normalized.fileName,
        sizeBytes: normalized.sizeBytes,
        contentType: putContentType,
        previewUrl,
        storageKey: presign.key,
        playbackUrl: presign.playbackUrl ?? null,
        storage: "r2",
      };
    }

    const complete = (await completeRes.json().catch(() => ({}))) as {
      ok?: boolean;
      playbackUrl?: string | null;
      error?: string;
    };

    if (!completeRes.ok || !complete.ok) {
      console.warn("[shorts/upload] complete failed:", complete.error);
    }

    return {
      videoId: presign.videoId,
      fileName: normalized.fileName,
      sizeBytes: normalized.sizeBytes,
      contentType: putContentType,
      previewUrl,
      storageKey: presign.key,
      playbackUrl: complete.playbackUrl || presign.playbackUrl || null,
      storage: "r2",
    };
  } catch (err) {
    URL.revokeObjectURL(previewUrl);
    logR2UploadDetailError(err, {
      fileName: normalized.fileName,
      contentType: putContentType,
      sizeBytes: normalized.sizeBytes,
    });
    throw err;
  }
}
