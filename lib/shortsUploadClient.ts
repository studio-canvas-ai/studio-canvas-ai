/**
 * Browser helper: presign → R2 PUT (with progress) → complete.
 * Large clips bypass Vercel's 4.5 MB function body limit via direct R2 upload.
 */

import {
  getShortsUploadProxyPutUrl,
  getShortsUploadProxySessionUrl,
  isSameOriginStreamUpload,
  isShortsUploadProxyConfigured,
  LEGACY_WORKERS_DEV_PROXY_URL,
  STREAM_UPLOAD_PATH,
  type WorkerUploadSessionResponse,
} from "@/lib/shortsUploadProxy";
import {
  DEFAULT_SHORTS_MAX_VIDEO_BYTES,
  formatBytes,
  isAllowedShortsVideo,
  normalizeShortsUploadFile,
  SHORTS_SERVER_CHUNK_BYTES,
  type ShortsStorageMode,
  type ShortsVideoAsset,
} from "@/lib/shortsVideo";

/** Initial PUT + up to 3 retries (4 presign+PUT rounds total). */
export const R2_PUT_MAX_ATTEMPTS = 4;

/** Mobile-friendly XHR timeout for large clips (5 min). */
export const R2_PUT_TIMEOUT_MS = 300_000;

/** Chunk size for mobile multipart uploads (5 MiB). */
export const MULTIPART_PART_BYTES = 5 * 1024 * 1024;

/** Use multipart on mobile when file exceeds this size. */
export const MULTIPART_THRESHOLD_BYTES = 5 * 1024 * 1024;

export type ShortsPresignResponse =
  | {
      ok: true;
      mode: "r2";
      videoId: string;
      key: string;
      contentType: string;
      putContentType?: string;
      uploadUrl: string;
      /** Cloudflare Worker PUT endpoint (mobile). */
      uploadProxyPutUrl?: string | null;
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
  | "server_chunk"
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

function isMobileLikeUploadClient(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    window.matchMedia?.("(pointer: coarse)")?.matches === true
  );
}

/** Mobile: worker stream PUT (whole File via XHR). Server-chunk file.slice() fails on Android gallery files. */
function shouldUseServerChunkUpload(): boolean {
  return false;
}

/** Direct R2 multipart from mobile browsers is unreliable (CORS + cellular drops). */
function shouldUseMultipartUpload(_sizeBytes: number): boolean {
  return false;
}

function shouldUseWorkerProxyUpload(
  presignProxyPutUrl?: string | null
): boolean {
  if (!isShortsUploadProxyConfigured(presignProxyPutUrl)) return false;
  // Desktop on production: direct R2 presigned PUT (fast, bypasses Vercel/CF proxy limits).
  if (isSameOriginStreamUpload() && !isMobileLikeUploadClient()) return false;
  // Mobile on production: Worker stream proxy (short session URL + PUT).
  if (isSameOriginStreamUpload()) return true;
  return isMobileLikeUploadClient();
}

/** Avoid re-slicing large Android gallery Files — hangs before XHR send. */
function stripBlobMime(body: Blob): Blob {
  if (!body.type) return body;
  if (body.size > 2 * 1024 * 1024) return body;
  return body.slice(0, body.size, "");
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
  /** Worker proxy: presigned R2 URL (metadata only). */
  r2PresignTargetUrl?: string;
  uploadMode?: "r2_direct" | "worker_proxy" | "worker_proxy_session" | "same_origin_stream";
  uploadPath?: string;
};

/**
 * Direct PUT to R2 — stream File/Blob body; no custom headers (avoids CORS preflight).
 */
function xhrPutWithProgress(
  url: string,
  file: Blob,
  opts: XhrPutOptions = {}
): Promise<string | void> {
  const timeoutMs = opts.timeoutMs ?? R2_PUT_TIMEOUT_MS;
  let lastProgressPct = 0;
  const body = stripBlobMime(file);

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
      r2Host: opts.r2PresignTargetUrl
        ? uploadHostFromUrl(opts.r2PresignTargetUrl)
        : null,
      blobSize: file.size,
      sizeBytes: opts.sizeBytes ?? file.size,
      progressPct: lastProgressPct,
      attempt: opts.attempt,
      maxAttempts: opts.maxAttempts,
      fileName: opts.fileName,
      contentType: opts.contentType ?? null,
      timeoutMs,
      putHeaders: "none",
      uploadMode:
        opts.uploadMode ??
        (opts.r2PresignTargetUrl
          ? isSameOriginStreamUpload()
            ? "same_origin_stream"
            : "worker_proxy_session"
          : "r2_direct"),
      uploadPath: opts.uploadPath ?? null,
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
        resolve(xhr.getResponseHeader("ETag") ?? undefined);
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

    xhr.send(body);
  });
}

/** POST presign URL in JSON body → short PUT URL (avoids long ?u= on mobile). */
async function registerWorkerUploadSession(
  sessionUrl: string,
  r2PresignUrl: string,
  signal?: AbortSignal
): Promise<{ putUrl: string; uploadId: string }> {
  let res: Response;
  try {
    res = await fetch(sessionUrl, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ target: r2PresignUrl }),
      signal,
    });
  } catch (err) {
    throw new ShortsUploadError("presign", "worker_session_network", {
      uploadPath: "POST /v1/session",
      uploadHost: uploadHostFromUrl(sessionUrl),
      cause: err,
      hint: "Network error registering Worker upload session",
    });
  }

  let data: WorkerUploadSessionResponse;
  try {
    data = (await res.json()) as WorkerUploadSessionResponse;
  } catch {
    throw new ShortsUploadError("presign", "worker_session_invalid_response", {
      uploadPath: "POST /v1/session",
      httpStatus: res.status,
      uploadHost: uploadHostFromUrl(sessionUrl),
    });
  }

  const putUrl = data.putUrl?.trim();
  if (!res.ok || !putUrl) {
    throw new ShortsUploadError("presign", "worker_session_failed", {
      uploadPath: "POST /v1/session",
      httpStatus: res.status,
      uploadHost: uploadHostFromUrl(sessionUrl),
      responseBody: JSON.stringify(data).slice(0, 500),
      error: data.error ?? null,
    });
  }

  return {
    putUrl: resolveWorkerStreamPutUrl(data.uploadId?.trim() ?? "", putUrl),
    uploadId: data.uploadId?.trim() ?? "",
  };
}

/** Large PUT must hit workers.dev — same-origin path proxies through Vercel (413 on ~50MB+). */
function resolveWorkerStreamPutUrl(uploadId: string, fallbackPutUrl: string): string {
  const id = uploadId.trim();
  if (id) {
    return `${LEGACY_WORKERS_DEV_PROXY_URL.replace(/\/$/, "")}${STREAM_UPLOAD_PATH}/v1/put/${id}`;
  }
  return fallbackPutUrl;
}

type MultipartInitResponse = {
  ok?: boolean;
  mode?: "r2_multipart";
  videoId: string;
  key: string;
  uploadId: string;
  contentType: string;
  playbackUrl?: string | null;
  error?: string;
};

async function fetchMultipartInit(
  payload: {
    fileName: string;
    contentType: string;
    sizeBytes: number;
    videoId?: string;
  },
  signal?: AbortSignal
): Promise<MultipartInitResponse> {
  let res: Response;
  try {
    res = await fetch("/api/shorts/multipart/init", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (cause) {
    throw new ShortsUploadError("presign", "multipart_init_network", {
      cause,
      uploadPath: "/api/shorts/multipart/init",
      ...payload,
    });
  }

  const json = (await res.json().catch(() => ({}))) as MultipartInitResponse;
  if (!res.ok || !json.uploadId || !json.key || !json.videoId) {
    throw new ShortsUploadError(
      "presign",
      json.error || `multipart_init_failed_${res.status}`,
      {
        httpStatus: res.status,
        responseBody: JSON.stringify(json).slice(0, 2000),
        uploadPath: "/api/shorts/multipart/init",
        ...payload,
      }
    );
  }
  return json;
}

async function fetchMultipartPartUrl(
  payload: { key: string; uploadId: string; partNumber: number },
  signal?: AbortSignal
): Promise<string> {
  let res: Response;
  try {
    res = await fetch("/api/shorts/multipart/part", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (cause) {
    throw new ShortsUploadError("presign", "multipart_part_network", {
      cause,
      uploadPath: "/api/shorts/multipart/part",
      ...payload,
    });
  }

  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    uploadUrl?: string;
    error?: string;
  };
  if (!res.ok || !json.uploadUrl) {
    throw new ShortsUploadError(
      "presign",
      json.error || `multipart_part_failed_${res.status}`,
      {
        httpStatus: res.status,
        responseBody: JSON.stringify(json).slice(0, 2000),
        uploadPath: "/api/shorts/multipart/part",
        ...payload,
      }
    );
  }
  return json.uploadUrl;
}

async function uploadShortsVideoMultipart(
  file: File,
  normalized: ReturnType<typeof normalizeShortsUploadFile>,
  check: { ok: true; contentType: string },
  previewUrl: string,
  opts?: {
    onProgress?: (pct: number) => void;
    signal?: AbortSignal;
    videoId?: string;
    reusePreviewUrl?: boolean;
  }
): Promise<ShortsVideoAsset> {
  const presignPayload = {
    fileName: normalized.fileName,
    contentType: check.contentType,
    sizeBytes: normalized.sizeBytes,
    videoId: opts?.videoId,
  };

  console.info("[shorts/upload] multipart start", presignPayload);

  const init = await fetchMultipartInit(presignPayload, opts?.signal);
  const partCount = Math.max(1, Math.ceil(file.size / MULTIPART_PART_BYTES));
  const parts: { partNumber: number; etag: string }[] = [];
  let uploadedBytes = 0;

  for (let partNumber = 1; partNumber <= partCount; partNumber++) {
    const start = (partNumber - 1) * MULTIPART_PART_BYTES;
    const end = Math.min(file.size, start + MULTIPART_PART_BYTES);
    const chunk = stripBlobMime(file.slice(start, end, ""));

    let etag: string | undefined;
    let lastErr: ShortsUploadError | null = null;

    for (let attempt = 1; attempt <= R2_PUT_MAX_ATTEMPTS; attempt++) {
      if (attempt > 1) {
        await sleep(backoffMsBeforeRetry(attempt));
      }

      const uploadUrl = await fetchMultipartPartUrl(
        {
          key: init.key,
          uploadId: init.uploadId,
          partNumber,
        },
        opts?.signal
      );

      try {
        const reportPartProgress = (partPct: number) => {
          const loaded = uploadedBytes + Math.round(((end - start) * partPct) / 100);
          const totalPct = Math.min(
            100,
            Math.round((loaded / file.size) * 100)
          );
          opts?.onProgress?.(totalPct);
        };

        const partEtag = await xhrPutWithProgress(uploadUrl, chunk, {
          onProgress: reportPartProgress,
          signal: opts?.signal,
          timeoutMs: R2_PUT_TIMEOUT_MS,
          attempt,
          maxAttempts: R2_PUT_MAX_ATTEMPTS,
          sizeBytes: end - start,
          fileName: normalized.fileName,
          contentType: check.contentType,
        });
        if (!partEtag) {
          throw new ShortsUploadError("r2_put", "multipart_part_etag_missing", {
            partNumber,
            hint:
              "R2 did not return ETag — add ETag to R2 bucket CORS ExposeHeaders.",
          });
        }
        etag = partEtag;
        lastErr = null;
        break;
      } catch (err) {
        lastErr =
          err instanceof ShortsUploadError
            ? err
            : new ShortsUploadError("r2_put", "r2_put_failed", { cause: err });
        if (!isRetryablePutError(lastErr) || attempt >= R2_PUT_MAX_ATTEMPTS) {
          throw lastErr;
        }
      }
    }

    if (!etag) {
      throw (
        lastErr ??
        new ShortsUploadError("r2_put", "multipart_part_etag_missing", {
          partNumber,
          hint:
            "R2 did not return ETag — add ETag to R2 bucket CORS ExposeHeaders.",
        })
      );
    }

    parts.push({ partNumber, etag });
    uploadedBytes = end;
    opts?.onProgress?.(Math.min(100, Math.round((uploadedBytes / file.size) * 100)));
  }

  let completeRes: Response;
  try {
    completeRes = await fetch("/api/shorts/multipart/complete", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoId: init.videoId,
        key: init.key,
        uploadId: init.uploadId,
        parts,
      }),
      signal: opts?.signal,
    });
  } catch (cause) {
    throw new ShortsUploadError("complete", "multipart_complete_network", {
      cause,
      videoId: init.videoId,
      key: init.key,
    });
  }

  const complete = (await completeRes.json().catch(() => ({}))) as {
    ok?: boolean;
    playbackUrl?: string | null;
    error?: string;
  };

  if (!completeRes.ok || !complete.ok) {
    throw new ShortsUploadError(
      "complete",
      complete.error || `multipart_complete_failed_${completeRes.status}`,
      {
        httpStatus: completeRes.status,
        responseBody: JSON.stringify(complete).slice(0, 2000),
      }
    );
  }

  console.info("[shorts/upload] multipart success", {
    videoId: init.videoId,
    partCount,
    sizeBytes: normalized.sizeBytes,
  });

  return {
    videoId: init.videoId,
    fileName: normalized.fileName,
    sizeBytes: normalized.sizeBytes,
    contentType: check.contentType,
    previewUrl,
    storageKey: init.key,
    playbackUrl: complete.playbackUrl || init.playbackUrl || null,
    storage: "r2",
  };
}

/** Mobile chunk POST timeout (2 min per slice). */
const SERVER_CHUNK_TIMEOUT_MS = 120_000;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

async function readFileSliceBuffer(
  file: File,
  start: number,
  end: number,
  partNumber: number
): Promise<ArrayBuffer> {
  const slice = file.slice(start, end, "");
  try {
    return await slice.arrayBuffer();
  } catch {
    /* Android gallery files often reject slice.arrayBuffer() — FileReader fallback */
  }

  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (result instanceof ArrayBuffer) resolve(result);
      else reject(new Error("filereader_empty"));
    };
    reader.onerror = () => {
      reject(
        new ShortsUploadError("server_chunk", "chunk_read_failed", {
          partNumber,
          sizeBytes: end - start,
          cause: reader.error,
        })
      );
    };
    reader.readAsArrayBuffer(slice);
  });
}

async function fetchPostChunk(
  url: string,
  body: BodyInit,
  contentType: string,
  opts: { signal?: AbortSignal; timeoutMs?: number }
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const timeoutMs = opts.timeoutMs ?? SERVER_CHUNK_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onParentAbort = () => controller.abort();
  if (opts.signal) {
    if (opts.signal.aborted) {
      clearTimeout(timer);
      throw new DOMException("Aborted", "AbortError");
    }
    opts.signal.addEventListener("abort", onParentAbort, { once: true });
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": contentType,
      },
      body,
      signal: controller.signal,
    });
    const parsed = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, body: parsed };
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onParentAbort);
  }
}

/** Same-origin chunk POST — JSON/base64 on mobile; binary fallback on desktop. */
async function postServerChunk(
  meta: { key: string; uploadId: string; partNumber: number },
  buffer: ArrayBuffer,
  opts: { signal?: AbortSignal; timeoutMs?: number }
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const chunkUrl =
    `/api/shorts/chunk?key=${encodeURIComponent(meta.key)}` +
    `&uploadId=${encodeURIComponent(meta.uploadId)}` +
    `&partNumber=${meta.partNumber}`;
  const jsonPayload = JSON.stringify({
    key: meta.key,
    uploadId: meta.uploadId,
    partNumber: meta.partNumber,
    data: arrayBufferToBase64(buffer),
  });

  if (isMobileLikeUploadClient()) {
    try {
      return await fetchPostChunk(
        "/api/shorts/chunk",
        jsonPayload,
        "application/json",
        opts
      );
    } catch (jsonErr) {
      console.warn("[shorts/upload] JSON chunk POST failed; retrying binary", {
        partNumber: meta.partNumber,
        bytes: buffer.byteLength,
        cause: jsonErr,
      });
      return await fetchPostChunk(
        chunkUrl,
        buffer,
        "application/octet-stream",
        opts
      );
    }
  }

  try {
    return await fetchPostChunk(
      chunkUrl,
      buffer,
      "application/octet-stream",
      opts
    );
  } catch (binaryErr) {
    console.warn("[shorts/upload] binary chunk POST failed; retrying JSON/base64", {
      partNumber: meta.partNumber,
      bytes: buffer.byteLength,
      cause: binaryErr,
    });
    return await fetchPostChunk(
      "/api/shorts/chunk",
      jsonPayload,
      "application/json",
      opts
    );
  }
}

type ServerChunkInitResponse = {
  ok?: boolean;
  mode?: "server_chunk" | "local";
  videoId: string;
  key: string | null;
  uploadId?: string;
  contentType: string;
  playbackUrl?: string | null;
  chunkBytes?: number;
  totalChunks?: number;
  error?: string;
};

async function uploadShortsVideoViaServerChunks(
  file: File,
  normalized: ReturnType<typeof normalizeShortsUploadFile>,
  check: { ok: true; contentType: string },
  previewUrl: string,
  opts?: {
    onProgress?: (pct: number) => void;
    signal?: AbortSignal;
    videoId?: string;
  }
): Promise<ShortsVideoAsset> {
  const payload = {
    fileName: normalized.fileName,
    contentType: check.contentType,
    sizeBytes: normalized.sizeBytes,
    videoId: opts?.videoId,
  };

  console.info("[shorts/upload] server-chunk start", payload);

  let initRes: Response;
  try {
    initRes = await fetch("/api/shorts/chunk/init", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: opts?.signal,
    });
  } catch (cause) {
    throw new ShortsUploadError("server_chunk", "chunk_init_network", {
      cause,
      uploadPath: "/api/shorts/chunk/init",
      ...payload,
    });
  }

  const init = (await initRes.json().catch(() => ({}))) as ServerChunkInitResponse;
  if (!initRes.ok) {
    throw new ShortsUploadError(
      "server_chunk",
      init.error || `chunk_init_failed_${initRes.status}`,
      {
        httpStatus: initRes.status,
        responseBody: JSON.stringify(init).slice(0, 2000),
        uploadPath: "/api/shorts/chunk/init",
        ...payload,
      }
    );
  }

  if (init.mode === "local" || !init.uploadId || !init.key) {
    opts?.onProgress?.(100);
    return {
      videoId: init.videoId,
      fileName: normalized.fileName,
      sizeBytes: normalized.sizeBytes,
      contentType: check.contentType,
      previewUrl,
      storageKey: null,
      playbackUrl: init.playbackUrl ?? null,
      storage: "local",
    };
  }

  const chunkBytes = init.chunkBytes ?? SHORTS_SERVER_CHUNK_BYTES;
  const totalChunks =
    init.totalChunks ?? Math.max(1, Math.ceil(file.size / chunkBytes));
  const parts: { partNumber: number; etag: string }[] = [];

  for (let partNumber = 1; partNumber <= totalChunks; partNumber++) {
    const start = (partNumber - 1) * chunkBytes;
    const end = Math.min(file.size, start + chunkBytes);

    let uploaded = false;
    let lastErr: ShortsUploadError | null = null;

    for (let attempt = 1; attempt <= R2_PUT_MAX_ATTEMPTS; attempt++) {
      if (attempt > 1) {
        await sleep(backoffMsBeforeRetry(attempt));
      }

      let chunkBuffer: ArrayBuffer;
      try {
        chunkBuffer = await readFileSliceBuffer(file, start, end, partNumber);
      } catch (err) {
        throw err instanceof ShortsUploadError
          ? err
          : new ShortsUploadError("server_chunk", "chunk_read_failed", {
              partNumber,
              cause: err,
            });
      }

      let chunkResult: { ok: boolean; status: number; body: Record<string, unknown> };
      try {
        chunkResult = await postServerChunk(
          {
            key: init.key,
            uploadId: init.uploadId,
            partNumber,
          },
          chunkBuffer,
          {
            signal: opts?.signal,
            timeoutMs: SERVER_CHUNK_TIMEOUT_MS,
          }
        );
      } catch (cause) {
        lastErr = new ShortsUploadError("server_chunk", "chunk_upload_network", {
          cause,
          uploadPath: "/api/shorts/chunk",
          partNumber,
          attempt,
          maxAttempts: R2_PUT_MAX_ATTEMPTS,
          sizeBytes: end - start,
          fileName: normalized.fileName,
          progressPct: Math.round((start / file.size) * 100),
        });
        if (attempt >= R2_PUT_MAX_ATTEMPTS) throw lastErr;
        continue;
      }

      const chunkJson = chunkResult.body as {
        ok?: boolean;
        etag?: string;
        error?: string;
      };

      if (!chunkResult.ok || !chunkJson.etag) {
        lastErr = new ShortsUploadError(
          "server_chunk",
          String(chunkJson.error || `chunk_upload_failed_${chunkResult.status}`),
          {
            httpStatus: chunkResult.status,
            responseBody: JSON.stringify(chunkJson).slice(0, 2000),
            uploadPath: "/api/shorts/chunk",
            partNumber,
            attempt,
            maxAttempts: R2_PUT_MAX_ATTEMPTS,
            sizeBytes: end - start,
            fileName: normalized.fileName,
            progressPct: Math.round((start / file.size) * 100),
          }
        );
        if (attempt >= R2_PUT_MAX_ATTEMPTS) throw lastErr;
        continue;
      }

      parts.push({ partNumber, etag: chunkJson.etag });
      uploaded = true;
      opts?.onProgress?.(Math.min(100, Math.round((end / file.size) * 100)));
      break;
    }

    if (!uploaded) {
      throw (
        lastErr ??
        new ShortsUploadError("server_chunk", "chunk_upload_failed", {
          partNumber,
          fileName: normalized.fileName,
        })
      );
    }
  }

  let completeRes: Response;
  try {
    completeRes = await fetch("/api/shorts/chunk/complete", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoId: init.videoId,
        key: init.key,
        uploadId: init.uploadId,
        parts,
      }),
      signal: opts?.signal,
    });
  } catch (cause) {
    throw new ShortsUploadError("server_chunk", "chunk_complete_network", {
      cause,
      uploadPath: "/api/shorts/chunk/complete",
      videoId: init.videoId,
    });
  }

  const complete = (await completeRes.json().catch(() => ({}))) as {
    ok?: boolean;
    playbackUrl?: string | null;
    error?: string;
  };

  if (!completeRes.ok || !complete.ok) {
    throw new ShortsUploadError(
      "server_chunk",
      complete.error || `chunk_complete_failed_${completeRes.status}`,
      {
        httpStatus: completeRes.status,
        responseBody: JSON.stringify(complete).slice(0, 2000),
        uploadPath: "/api/shorts/chunk/complete",
      }
    );
  }

  console.info("[shorts/upload] server-chunk success", {
    videoId: init.videoId,
    totalChunks,
    sizeBytes: normalized.sizeBytes,
  });

  return {
    videoId: init.videoId,
    fileName: normalized.fileName,
    sizeBytes: normalized.sizeBytes,
    contentType: check.contentType,
    previewUrl,
    storageKey: init.key,
    playbackUrl: complete.playbackUrl || init.playbackUrl || null,
    storage: "r2",
  };
}

async function fetchShortsPresign(
  payload: {
    fileName: string;
    contentType: string;
    sizeBytes: number;
    videoId?: string;
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

/** User-visible upload failure copy — short summary first, details optional. */
export function formatShortsUploadErrorForDisplay(err: unknown): string {
  if (err instanceof ShortsUploadError) {
    const d = err.details;
    const sizeLabel =
      typeof d.sizeHuman === "string"
        ? d.sizeHuman
        : typeof d.sizeBytes === "number"
          ? formatBytes(d.sizeBytes)
          : null;

    if (err.stage === "validate") {
      if (err.message === "file_too_large") {
        return `파일이 너무 큽니다 (최대 100MB).${sizeLabel ? ` 현재: ${sizeLabel}` : ""}`;
      }
      if (err.message === "unsupported_type") {
        return "MP4, MOV, WebM 영상만 업로드할 수 있습니다.";
      }
      return "선택한 파일을 업로드할 수 없습니다.";
    }

    if (err.stage === "server_chunk") {
      const part =
        d.partNumber != null ? ` (${d.partNumber}번째 조각)` : "";
      if (
        err.message === "auth_session_required" ||
        d.httpStatus === 401
      ) {
        return "로그인 세션이 만료되었습니다. 로그아웃 후 다시 로그인해 주세요.";
      }
      if (err.message === "chunk_read_failed") {
        return `영상 파일을 읽을 수 없습니다${part}. 다른 영상으로 시도해 주세요.`;
      }
      if (typeof d.httpStatus === "number") {
        return `영상 업로드 실패${part} (HTTP ${d.httpStatus}). Wi-Fi에서 다시 시도해 주세요.`;
      }
      return `영상 업로드 중 연결 오류${part}. Wi-Fi에서 다시 시도해 주세요.`;
    }

    if (err.stage === "r2_put" && err.message === "r2_put_network") {
      return "영상 전송 중 연결이 끊겼습니다. 네트워크 상태를 확인하고 다시 시도해 주세요.";
    }

    if (err.stage === "presign") {
      return "업로드 준비에 실패했습니다. 새로고침 후 다시 시도해 주세요.";
    }

    if (err.stage === "complete") {
      return "업로드는 됐지만 마무리 처리에 실패했습니다. 다시 시도해 주세요.";
    }

    const progress =
      typeof d.progressPct === "number" ? ` · ${d.progressPct}%` : "";
    const code = `[${err.stage}] ${err.message}${progress}`;
    if (typeof d.hint === "string" && d.hint.trim()) {
      return `${code}\n${d.hint.trim()}`;
    }
    return code;
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
    videoId?: string;
    previewUrl?: string;
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

  const reusePreview = Boolean(opts?.previewUrl);
  const previewUrl = opts?.previewUrl ?? URL.createObjectURL(file);
  const presignPayload = {
    fileName: normalized.fileName,
    contentType: check.contentType,
    sizeBytes: normalized.sizeBytes,
    videoId: opts?.videoId,
  };

  console.info("[shorts/upload] start", {
    ...presignPayload,
    maxAttempts: R2_PUT_MAX_ATTEMPTS,
    putTimeoutMs: R2_PUT_TIMEOUT_MS,
    serverChunk: shouldUseServerChunkUpload(),
    multipart: shouldUseMultipartUpload(normalized.sizeBytes),
    workerProxy: isShortsUploadProxyConfigured(),
  });

  opts?.onProgress?.(1);

  if (shouldUseMultipartUpload(normalized.sizeBytes)) {
    try {
      return await uploadShortsVideoMultipart(
        file,
        normalized,
        check,
        previewUrl,
        opts
      );
    } catch (err) {
      if (!reusePreview) URL.revokeObjectURL(previewUrl);
      logR2UploadDetailError(err, {
        fileName: normalized.fileName,
        contentType: check.contentType,
        sizeBytes: normalized.sizeBytes,
        uploadMode: "r2_multipart",
      });
      throw err;
    }
  }

  if (shouldUseServerChunkUpload()) {
    try {
      return await uploadShortsVideoViaServerChunks(
        file,
        normalized,
        check,
        previewUrl,
        opts
      );
    } catch (err) {
      if (!reusePreview) URL.revokeObjectURL(previewUrl);
      logR2UploadDetailError(err, {
        fileName: normalized.fileName,
        contentType: check.contentType,
        sizeBytes: normalized.sizeBytes,
        uploadMode: "server_chunk",
      });
      throw err;
    }
  }

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
      const proxyPutUrl = getShortsUploadProxyPutUrl(presign.uploadProxyPutUrl);
      const useStreamUpload = shouldUseWorkerProxyUpload(presign.uploadProxyPutUrl);
      let putUrl = presign.uploadUrl;
      let workerSessionId: string | null = null;
      const sameOrigin = isSameOriginStreamUpload();

      if (useStreamUpload && proxyPutUrl) {
        const sessionUrl = getShortsUploadProxySessionUrl(presign.uploadProxyPutUrl);
        if (!sessionUrl) {
          throw new ShortsUploadError("presign", "worker_session_url_missing", {
            hint: "Stream upload session URL is not configured",
          });
        }
        const session = await registerWorkerUploadSession(
          sessionUrl,
          presign.uploadUrl,
          opts?.signal
        );
        putUrl = session.putUrl;
        workerSessionId = session.uploadId || null;
      }

      try {
        opts?.onProgress?.(0);
        await xhrPutWithProgress(putUrl, file, {
          onProgress: opts?.onProgress,
          signal: opts?.signal,
          timeoutMs: R2_PUT_TIMEOUT_MS,
          attempt,
          maxAttempts: R2_PUT_MAX_ATTEMPTS,
          sizeBytes: normalized.sizeBytes,
          fileName: normalized.fileName,
          contentType: putContentType,
          r2PresignTargetUrl: useStreamUpload ? presign.uploadUrl : undefined,
          uploadMode: useStreamUpload
            ? sameOrigin
              ? "same_origin_stream"
              : "worker_proxy_session"
            : "r2_direct",
          uploadPath: useStreamUpload
            ? sameOrigin
              ? `POST ${STREAM_UPLOAD_PATH}/v1/session → PUT ${STREAM_UPLOAD_PATH}/v1/put/${workerSessionId ?? ":id"}`
              : `POST /v1/session → PUT /v1/put/${workerSessionId ?? ":id"}`
            : undefined,
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
    if (!reusePreview) URL.revokeObjectURL(previewUrl);
    logR2UploadDetailError(err, {
      fileName: normalized.fileName,
      contentType: putContentType,
      sizeBytes: normalized.sizeBytes,
      maxAttempts: R2_PUT_MAX_ATTEMPTS,
    });
    throw err;
  }
}
