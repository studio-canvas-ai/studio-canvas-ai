/**
 * Browser helper: FormData → POST /api/shorts/upload (server proxies to R2).
 * Avoids mobile CORS/network failures from direct presigned PUT to R2.
 */

import {
  DEFAULT_SHORTS_MAX_VIDEO_BYTES,
  isAllowedShortsVideo,
  normalizeShortsUploadFile,
  type ShortsStorageMode,
  type ShortsVideoAsset,
} from "@/lib/shortsVideo";

export type ShortsUploadResponse =
  | {
      ok: true;
      mode: "r2";
      videoId: string;
      key: string;
      contentType: string;
      playbackUrl?: string | null;
      fileName?: string;
      sizeBytes?: number;
      maxBytes?: number;
    }
  | {
      ok: true;
      mode: "local";
      videoId: string;
      key: null;
      contentType: string;
      playbackUrl?: string | null;
      fileName?: string;
      sizeBytes?: number;
      maxBytes?: number;
      note?: string;
    }
  | { ok?: false; error?: string; maxBytes?: number };

export type ShortsUploadErrorStage =
  | "validate"
  | "server_upload"
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

function xhrFormUploadWithProgress(
  url: string,
  formData: FormData,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal
): Promise<{ status: number; responseText: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.withCredentials = true;

    const onAbort = () => xhr.abort();
    if (signal) {
      if (signal.aborted) {
        reject(new ShortsUploadError("server_upload", "upload_aborted", {}));
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }

    xhr.upload.onprogress = (ev) => {
      if (!ev.lengthComputable || !onProgress) return;
      onProgress(Math.min(100, Math.round((ev.loaded / ev.total) * 100)));
    };
    xhr.onload = () => {
      if (signal) signal.removeEventListener("abort", onAbort);
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve({
          status: xhr.status,
          responseText: xhr.responseText ?? "",
        });
        return;
      }
      const fileField = formData.get("file");
      reject(
        new ShortsUploadError(
          "server_upload",
          `upload_http_${xhr.status}`,
          {
            httpStatus: xhr.status,
            responseText: (xhr.responseText ?? "").slice(0, 2000),
            uploadPath: url,
            blobSize: fileField instanceof Blob ? fileField.size : null,
          }
        )
      );
    };
    xhr.onerror = () => {
      if (signal) signal.removeEventListener("abort", onAbort);
      reject(
        new ShortsUploadError("server_upload", "upload_network", {
          hint: "Network error while uploading to /api/shorts/upload",
          uploadPath: url,
        })
      );
    };
    xhr.onabort = () => {
      if (signal) signal.removeEventListener("abort", onAbort);
      reject(new ShortsUploadError("server_upload", "upload_aborted", {}));
    };
    xhr.send(formData);
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
  const formData = new FormData();
  formData.append("file", file, normalized.fileName);
  formData.append("fileName", normalized.fileName);
  formData.append("contentType", check.contentType);

  console.info("[shorts/upload] POST /api/shorts/upload", {
    fileName: normalized.fileName,
    contentType: check.contentType,
    sizeBytes: normalized.sizeBytes,
  });

  try {
    opts?.onProgress?.(0);
    const uploadResult = await xhrFormUploadWithProgress(
      "/api/shorts/upload",
      formData,
      opts?.onProgress,
      opts?.signal
    );

    let payload: ShortsUploadResponse;
    try {
      payload = JSON.parse(uploadResult.responseText) as ShortsUploadResponse;
    } catch {
      payload = {};
    }

    if (!payload || !("ok" in payload) || !payload.ok || !("mode" in payload)) {
      const err = new ShortsUploadError(
        "server_upload",
        (payload as { error?: string })?.error ||
          `upload_failed_${uploadResult.status}`,
        {
          httpStatus: uploadResult.status,
          responseBody: uploadResult.responseText.slice(0, 2000),
        }
      );
      logR2UploadDetailError(err);
      URL.revokeObjectURL(previewUrl);
      throw err;
    }

    return {
      videoId: payload.videoId,
      fileName: payload.fileName || normalized.fileName,
      sizeBytes: payload.sizeBytes ?? normalized.sizeBytes,
      contentType: payload.contentType || check.contentType,
      previewUrl,
      storageKey: payload.mode === "r2" ? payload.key : null,
      playbackUrl: payload.playbackUrl ?? null,
      storage: (payload.mode === "r2" ? "r2" : "local") satisfies ShortsStorageMode,
    };
  } catch (err) {
    URL.revokeObjectURL(previewUrl);
    logR2UploadDetailError(err, {
      fileName: normalized.fileName,
      contentType: check.contentType,
      sizeBytes: normalized.sizeBytes,
    });
    throw err;
  }
}
