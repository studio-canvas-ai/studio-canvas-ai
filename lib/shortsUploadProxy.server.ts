/** Build Worker proxy PUT URL for presign responses (server-side). */
export function resolveShortsUploadProxyPutUrl(): string | null {
  const raw =
    process.env.SHORTS_UPLOAD_PROXY_URL?.trim() ||
    process.env.NEXT_PUBLIC_SHORTS_UPLOAD_PROXY_URL?.trim();
  if (!raw) return null;
  return `${raw.replace(/\/$/, "")}/v1/put`;
}
