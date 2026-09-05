/**
 * Shared print-design share helpers (client + server safe).
 * R2 I/O lives in shareImageStore.server.ts.
 */

/** Must match Kakao JS SDK registered web domain. */
export const SHARE_VIEWER_ORIGIN = "https://www.studio-canvas-ai.com";

export type ShareImageMeta = {
  id: string;
  title: string;
  description: string;
  contentType: string;
  imageKey: string;
  createdAt: number;
};

export function sharePublicImageKey(id: string, ext: "png" | "jpg" | "webp"): string {
  return `share/public/${id}.${ext}`;
}

export function sharePublicMetaKey(id: string): string {
  return `share/public/${id}.json`;
}

export function extFromContentType(contentType: string): "png" | "jpg" | "webp" {
  const ct = contentType.toLowerCase();
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  return "jpg";
}

export function filenameFromShareMeta(meta: ShareImageMeta): string {
  const ext = extFromContentType(meta.contentType);
  return `studio-canvas-${meta.id.slice(0, 8)}.${ext}`;
}

/** Absolute viewer URL for Kakao cards / clipboard (registered production domain). */
export function buildShareViewerUrl(shareId: string): string {
  return `${SHARE_VIEWER_ORIGIN}/share/${shareId}`;
}

/**
 * Prefer localhost origin while developing; production always uses registered domain
 * so Kakao SDK link validation succeeds.
 */
export function resolveShareViewerUrl(shareId: string): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return `${window.location.origin}/share/${shareId}`;
    }
  }
  return buildShareViewerUrl(shareId);
}

export function sanitizeShareId(raw: string): string {
  return String(raw ?? "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 64);
}
