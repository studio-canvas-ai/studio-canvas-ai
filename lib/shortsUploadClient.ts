/**
 * Browser helper: presign → R2 PUT (with progress) → complete.
 * Large clips bypass Vercel's 4.5 MB function body limit via direct R2 upload.
 */

import {
  DEFAULT_SHORTS_MAX_VIDEO_BYTES,
  formatBytes,
  isAllowedShortsVideo,
  normalizeShortsUploadFile,
  type ShortsStorageMode,
  type ShortsVideoAsset,
} from "@/lib/shortsVideo";

/** Initial PUT + up to 3 retries (4 presign+PUT rounds total). */
export const R2_PUT_MAX_ATTEMPTS = 4;

/** Mobile-friendly XHR timeout for large clips (5 min). */
export const R2_PUT_TIMEOUT_MS = 300_000;

export type ShortsPresignResponse =
  | {
      ok: true;
      mode: "r2";
      videoId: string;
      key: string;
      contentType: string;
      putContentType?: string;
      uploadUrl: string;
      requiredHeaders?: Record<string, string>;
      bucket?: string;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uploadHostFromUrl(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function backoffMsBeforeRetry(attempt: number): number {
  // attempt 2 → 1s, 3 → 2s, 4 → 4s (capped at 8s)
  const exponent = Math.max(0, attempt - 2);
  return Math.min(8000, 1000 * 2 ** exponent);
}

function isRetryablePutError(err: unknown): boolean {
  if (!(err instanceof ShortsUploadError) || err.stage !== "r2_put") {
    return false;
  }
  if (err.message === "r2_put_aborted") return false;
  const status = err.details.httpStatus;
  if (status === 413 || status === 415) return false;
  return true;
}

function enrichPutError(
  err: ShortsUploadError,
  ctx: {
    attempt: number;
    maxAttempts: number;
    progressPct: number;
    sizeBytes: number;
    fileName: string;
    contentType: string;
  }
): ShortsUploadError {
  return new ShortsUploadError(err.stage, err.message, {
    ...err.details,
    attempt: ctx.attempt,
    maxAttempts: ctx.maxAttempts,
    progressPct: ctx.progressPct,
    sizeBytes: ctx.sizeBytes,
    sizeHuman: formatBytes(ctx.sizeBytes),
    fileName: ctx.fileName,
    contentType: ctx.contentType,
  });
}

/** Single source for PUT Content-Type — always server-normalized, never raw file.type. */
function resolveR2PutContentType(
  presign: Extract<ShortsPresignResponse, { mode: "r2" }>,
  validatedContentType: string
): string {
  const fromPresign =
    presign.putContentType?.trim() || presign.contentType?.trim() || "";
  return fromPresign || validatedContentType;
}

type XhrPutOptions = {
  onProgress?: (pct: number) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
  attempt?: number;
  maxAttempts?: number;
  sizeBytes?: number;
  fileName?: string;
  /** Metadata for errors only — not sent as a request header. */
  contentType?: string;
};

/**
 * Direct PUT to R2 — stream File/Blob body; no custom headers (avoids CORS preflight).
 */
function xhrPutWithProgress(
  url: string,
  file: Blob,
  opts: XhrPutOptions = {}
): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? R2_PUT_TIMEOUT_MS;
  let lastProgressPct = 0;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    if (timeoutMs > 0) xhr.timeout = timeoutMs;

    const onAbort = () => xhr.abort();
    if (opts.signal) {
      if (opts.signal.aborted) {
        reject(new ShortsUploadError("r2_put", "r2_put_aborted", {}));
        return;
      }
      opts.signal.addEventListener("abort", onAbort, { once: true });
    }

    const baseDetails = () => ({
      uploadHost: uploadHostFromUrl(url),
      blobSize: file.size,
      sizeBytes: opts.sizeBytes ?? file.size,
      progressPct: lastProgressPct,
      attempt: opts.attempt,
      maxAttempts: opts.maxAttempts,
      fileName: opts.fileName,
      contentType: opts.contentType ?? null,
      timeoutMs,
      putHeaders: "none",
    });

    xhr.upload.onprogress = (ev) => {
      if (!ev.lengthComputable) return;
      lastProgressPct = Math.min(
        100,
        Math.round((ev.loaded / ev.total) * 100)
      );
      opts.onProgress?.(lastProgressPct);
    };

    xhr.onload = () => {
      if (opts.signal) opts.signal.removeEventListener("abort", onAbort);
      if (xhr.status >= 200 && xhr.status < 300) {
        lastProgressPct = 100;
        opts.onProgress?.(100);
        resolve();
        return;
      }
      reject(
        new ShortsUploadError("r2_put", `r2_put_http_${xhr.status}`, {
          ...baseDetails(),
          httpStatus: xhr.status,
          responseText: (xhr.responseText ?? "").slice(0, 2000),
        })
      );
    };

    xhr.onerror = () => {
      if (opts.signal) opts.signal.removeEventListener("abort", onAbort);
      reject(
        new ShortsUploadError("r2_put", "r2_put_network", {
          ...baseDetails(),
          hint:
            "Network error during R2 PUT (connection lost or blocked before response)",
        })
      );
    };

    xhr.ontimeout = () => {
      if (opts.signal) opts.signal.removeEventListener("abort", onAbort);
      reject(
        new ShortsUploadError("r2_put", "r2_put_timeout", {
          ...baseDetails(),
          hint: `R2 PUT timed out after ${Math.round(timeoutMs / 1000)}s`,
        })
      );
    };

    xhr.onabort = () => {
      if (opts.signal) opts.signal.removeEventListener("abort", onAbort);
      reject(
        new ShortsUploadError("r2_put", "r2_put_aborted", {
          ...baseDetails(),
        })
      );
    };

    xhr.send(file);
  });
}

async function fetchShortsPresign(
  payload: {
    fileName: string;
    contentType: string;
    sizeBytes: number;
  },
  signal?: AbortSignal
): Promise<Extract<ShortsPresignResponse, { mode: "r2" } | { mode: "local" }>> {
  let presignRes: Response;
  try {
    presignRes = await fetch("/api/shorts/presign", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (cause) {
    throw new ShortsUploadError("presign", "presign_network", {
      cause,
      uploadPath: "/api/shorts/presign",
      sizeBytes: payload.sizeBytes,
      fileName: payload.fileName,
    });
  }

  let presign: ShortsPresignResponse;
  try {
    presign = (await presignRes.json()) as ShortsPresignResponse;
  } catch {
    presign = {};
  }

  if (!presignRes.ok || !presign || !("mode" in presign)) {
    throw new ShortsUploadError(
      "presign",
      (presign as { error?: string })?.error ||
        `presign_failed_${presignRes.status}`,
      {
        httpStatus: presignRes.status,
        responseBody: JSON.stringify(presign).slice(0, 2000),
        uploadPath: "/api/shorts/presign",
        sizeBytes: payload.sizeBytes,
        fileName: payload.fileName,
      }
    );
  }

  return presign;
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

    const uploadMeta = [
      d.fileName != null ? `file=${detailToText(d.fileName)}` : null,
      d.sizeHuman != null
        ? `size=${detailToText(d.sizeHuman)}`
        : d.sizeBytes != null
          ? `size=${detailToText(d.sizeBytes)}B`
          : null,
      d.progressPct != null ? `progress=${detailToText(d.progressPct)}%` : null,
      d.attempt != null && d.maxAttempts != null
        ? `attempt=${detailToText(d.attempt)}/${detailToText(d.maxAttempts)}`
        : null,
      d.timeoutMs != null
        ? `timeout=${Math.round(Number(d.timeoutMs) / 1000)}s`
        : null,
    ].filter(Boolean);
    if (uploadMeta.length) lines.push(uploadMeta.join(" · "));

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
  const presignPayload = {
    fileName: normalized.fileName,
    contentType: check.contentType,
    sizeBytes: normalized.sizeBytes,
  };

  console.info("[shorts/upload] start", {
    ...presignPayload,
    maxAttempts: R2_PUT_MAX_ATTEMPTS,
    putTimeoutMs: R2_PUT_TIMEOUT_MS,
  });

  let lastPutError: ShortsUploadError | null = null;
  let presignR2: Extract<ShortsPresignResponse, { mode: "r2" }> | null = null;
  let putContentType = check.contentType;

  try {
    for (let attempt = 1; attempt <= R2_PUT_MAX_ATTEMPTS; attempt++) {
      if (attempt > 1) {
        const waitMs = backoffMsBeforeRetry(attempt);
        console.info("[shorts/upload] PUT retry", {
          attempt,
          maxAttempts: R2_PUT_MAX_ATTEMPTS,
          waitMs,
          lastError: lastPutError?.message,
          progressPct: lastPutError?.details.progressPct,
        });
        opts?.onProgress?.(0);
        await sleep(waitMs);
      }

      console.info("[shorts/upload] POST /api/shorts/presign", {
        attempt,
        ...presignPayload,
      });

      const presign = await fetchShortsPresign(presignPayload, opts?.signal);

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

      presignR2 = presign;
      putContentType = resolveR2PutContentType(presign, check.contentType);

      try {
        opts?.onProgress?.(0);
        await xhrPutWithProgress(presign.uploadUrl, file, {
          onProgress: opts?.onProgress,
          signal: opts?.signal,
          timeoutMs: R2_PUT_TIMEOUT_MS,
          attempt,
          maxAttempts: R2_PUT_MAX_ATTEMPTS,
          sizeBytes: normalized.sizeBytes,
          fileName: normalized.fileName,
          contentType: putContentType,
        });
        lastPutError = null;
        break;
      } catch (err) {
        const putErr =
          err instanceof ShortsUploadError
            ? enrichPutError(err, {
                attempt,
                maxAttempts: R2_PUT_MAX_ATTEMPTS,
                progressPct:
                  typeof err.details.progressPct === "number"
                    ? err.details.progressPct
                    : 0,
                sizeBytes: normalized.sizeBytes,
                fileName: normalized.fileName,
                contentType: putContentType,
              })
            : new ShortsUploadError("r2_put", "r2_put_failed", {
                cause: err,
                attempt,
                maxAttempts: R2_PUT_MAX_ATTEMPTS,
                sizeBytes: normalized.sizeBytes,
                fileName: normalized.fileName,
              });

        lastPutError = putErr;
        logR2UploadDetailError(putErr, { phase: "shorts_put_attempt" });

        if (!isRetryablePutError(putErr) || attempt >= R2_PUT_MAX_ATTEMPTS) {
          throw putErr;
        }
      }
    }

    if (!presignR2) {
      throw (
        lastPutError ??
        new ShortsUploadError("r2_put", "r2_put_failed", {
          sizeBytes: normalized.sizeBytes,
          fileName: normalized.fileName,
        })
      );
    }

    let completeRes: Response;
    try {
      completeRes = await fetch("/api/shorts/complete", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: presignR2.videoId,
          key: presignR2.key,
        }),
        signal: opts?.signal,
      });
    } catch (cause) {
      console.warn("[shorts/upload] complete network failed:", cause);
      return {
        videoId: presignR2.videoId,
        fileName: normalized.fileName,
        sizeBytes: normalized.sizeBytes,
        contentType: putContentType,
        previewUrl,
        storageKey: presignR2.key,
        playbackUrl: presignR2.playbackUrl ?? null,
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

    console.info("[shorts/upload] success", {
      videoId: presignR2.videoId,
      sizeBytes: normalized.sizeBytes,
    });

    return {
      videoId: presignR2.videoId,
      fileName: normalized.fileName,
      sizeBytes: normalized.sizeBytes,
      contentType: putContentType,
      previewUrl,
      storageKey: presignR2.key,
      playbackUrl: complete.playbackUrl || presignR2.playbackUrl || null,
      storage: "r2",
    };
  } catch (err) {
    URL.revokeObjectURL(previewUrl);
    logR2UploadDetailError(err, {
      fileName: normalized.fileName,
      contentType: putContentType,
      sizeBytes: normalized.sizeBytes,
      maxAttempts: R2_PUT_MAX_ATTEMPTS,
    });
    throw err;
  }
}
