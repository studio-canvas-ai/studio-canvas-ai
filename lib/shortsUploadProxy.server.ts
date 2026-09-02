import { STREAM_UPLOAD_PATH } from "@/lib/shortsUploadProxy";

/** Build same-origin stream upload PUT base for presign responses (server-side). */
export function resolveShortsUploadProxyPutUrl(): string | null {
  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "https://www.studio-canvas-ai.com";
  return `${site.replace(/\/$/, "")}${STREAM_UPLOAD_PATH}/v1/put`;
}

/** Session registration URL (server-side hint for clients). */
export function resolveShortsUploadProxySessionUrl(): string | null {
  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "https://www.studio-canvas-ai.com";
  return `${site.replace(/\/$/, "")}${STREAM_UPLOAD_PATH}/v1/session`;
}
