/** Same-origin stream upload path (Cloudflare Worker route on production). */
export const STREAM_UPLOAD_PATH = "/api/shorts/stream-upload";

/** Legacy workers.dev fallback for localhost / preview mobile testing. */
export const LEGACY_WORKERS_DEV_PROXY_URL =
  "https://studio-canvas-shorts-r2-upload.agapet1004.workers.dev";

const PRODUCTION_HOSTS = new Set([
  "studio-canvas-ai.com",
  "www.studio-canvas-ai.com",
]);

/** Browser is on production studio domain → use same-origin Worker route. */
export function getStreamUploadOrigin(): string | null {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname.toLowerCase();
  if (!PRODUCTION_HOSTS.has(host)) return null;
  return window.location.origin;
}

export function isSameOriginStreamUpload(): boolean {
  return getStreamUploadOrigin() != null;
}

/** Client-side upload proxy base URL (no trailing slash). */
export function getShortsUploadProxyBaseUrl(): string | null {
  const sameOrigin = getStreamUploadOrigin();
  if (sameOrigin) {
    return `${sameOrigin}${STREAM_UPLOAD_PATH}`;
  }

  const raw =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_SHORTS_UPLOAD_PROXY_URL?.trim()
      : "";
  const base = raw || LEGACY_WORKERS_DEV_PROXY_URL;
  return base.replace(/\/$/, "");
}

/** @deprecated Legacy query-param PUT. */
export function buildWorkerProxyPutUrl(
  proxyPutBase: string,
  r2PresignUrl: string
): string {
  const base = proxyPutBase.replace(/\/$/, "");
  return `${base}?u=${encodeURIComponent(r2PresignUrl)}`;
}

export function getShortsUploadProxySessionUrl(
  presignProxyPutUrl?: string | null
): string | null {
  const putUrl = getShortsUploadProxyPutUrl(presignProxyPutUrl);
  if (!putUrl) return null;
  return putUrl.replace(/\/v1\/put\/?$/, "/v1/session");
}

export type WorkerUploadSessionResponse = {
  ok?: boolean;
  uploadId?: string;
  putUrl?: string;
  expiresInSec?: number;
  sameOrigin?: boolean;
  error?: string;
};

export function getShortsUploadProxyPutUrl(
  presignProxyPutUrl?: string | null
): string | null {
  const fromPresign = presignProxyPutUrl?.trim();
  if (fromPresign) return fromPresign;
  const base = getShortsUploadProxyBaseUrl();
  return base ? `${base}/v1/put` : null;
}

export function isShortsUploadProxyConfigured(
  presignProxyPutUrl?: string | null
): boolean {
  return getShortsUploadProxyPutUrl(presignProxyPutUrl) != null;
}
