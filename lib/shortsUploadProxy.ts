/** Client-side Worker proxy base URL (no trailing slash). */
export function getShortsUploadProxyBaseUrl(): string | null {
  const raw =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_SHORTS_UPLOAD_PROXY_URL?.trim()
      : "";
  return raw ? raw.replace(/\/$/, "") : null;
}

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
