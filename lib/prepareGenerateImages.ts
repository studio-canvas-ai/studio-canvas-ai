/**
 * Client-side: compress face photos and upload to Fal CDN before /api/generate.
 * Keeps the generate request body as light https URL strings (Vercel ~4.5MB limit).
 */

import { apiFetchJson } from "@/lib/apiFetch";
import { blobToCompressedDataUrl } from "@/lib/processUpload";

/** Inference-oriented compression — smaller than gallery vault storage. */
export const INFER_UPLOAD_MAX_EDGE = 1024;
export const INFER_UPLOAD_JPEG_QUALITY = 0.72;
/** Cap how many refs we send (Fal Kontext uses 1; InstantID can use a few). */
export const INFER_UPLOAD_MAX_IMAGES = 3;
/** Soft cap for a single data URI we will POST to /api/fal/upload. */
const MAX_UPLOAD_DATA_CHARS = 2_800_000;

async function compressForInference(url: string): Promise<string> {
  const trimmed = url.trim();
  if (!trimmed) throw new Error("empty_image_url");

  if (/^https:\/\//i.test(trimmed)) {
    if (trimmed.includes("fal.media") || trimmed.includes("fal.ai")) {
      return trimmed;
    }
    // Public https — still compress via fetch when possible for size; if CORS
    // blocks, pass the URL through and let the server fetch/upload.
    try {
      const res = await fetch(trimmed, { mode: "cors", cache: "no-store" });
      if (!res.ok) return trimmed;
      const blob = await res.blob();
      return blobToCompressedDataUrl(
        blob,
        INFER_UPLOAD_MAX_EDGE,
        INFER_UPLOAD_JPEG_QUALITY
      );
    } catch {
      return trimmed;
    }
  }

  if (trimmed.startsWith("data:image/")) {
    const res = await fetch(trimmed);
    const blob = await res.blob();
    return blobToCompressedDataUrl(
      blob,
      INFER_UPLOAD_MAX_EDGE,
      INFER_UPLOAD_JPEG_QUALITY
    );
  }

  // blob: / relative — fetch then compress.
  const res = await fetch(trimmed);
  if (!res.ok) throw new Error(`image_fetch_failed:${res.status}`);
  const blob = await res.blob();
  return blobToCompressedDataUrl(
    blob,
    INFER_UPLOAD_MAX_EDGE,
    INFER_UPLOAD_JPEG_QUALITY
  );
}

async function uploadOneToFalCdn(image: string): Promise<string> {
  if (
    /^https:\/\//i.test(image) &&
    (image.includes("fal.media") || image.includes("fal.ai"))
  ) {
    return image;
  }

  if (image.startsWith("data:") && image.length > MAX_UPLOAD_DATA_CHARS) {
    throw new Error("image_too_large_after_compress");
  }

  const result = await apiFetchJson<{
    ok?: boolean;
    url?: string;
    message?: string;
    error?: string;
  }>("/api/fal/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image }),
  });

  if (result.ok && result.data?.url) {
    return result.data.url;
  }

  // No FAL_KEY / upload unavailable — keep a tightly compressed data URI for mock/other providers.
  if (
    result.status === 503 ||
    result.data?.error === "fal_unconfigured"
  ) {
    if (image.startsWith("data:") && image.length <= MAX_UPLOAD_DATA_CHARS) {
      console.warn(
        "[prepareGenerateImages] Fal upload unavailable; using compressed data URI fallback"
      );
      return image;
    }
    if (/^https:\/\//i.test(image)) return image;
  }

  const msg =
    result.data?.message ||
    result.data?.error ||
    result.error ||
    `fal_upload_http_${result.status}`;
  throw new Error(String(msg));
}

/**
 * Compress + upload face refs. Returns https CDN URLs safe for /api/generate.
 */
export async function prepareGenerateImageUrls(
  urls: string[],
  opts?: { maxImages?: number }
): Promise<string[]> {
  const max = opts?.maxImages ?? INFER_UPLOAD_MAX_IMAGES;
  const slice = urls
    .filter((u) => typeof u === "string" && u.trim().length > 0)
    .slice(0, max);

  const out: string[] = [];
  for (const url of slice) {
    const compressed = await compressForInference(url);
    if (/^https:\/\//i.test(compressed) && !compressed.startsWith("data:")) {
      // Remote URL that we couldn't/didn't need to re-encode — upload via server
      // so Fal gets a durable CDN copy (avoids hotlink / auth issues).
      if (compressed.includes("fal.media") || compressed.includes("fal.ai")) {
        out.push(compressed);
      } else {
        out.push(await uploadOneToFalCdn(compressed));
      }
      continue;
    }
    out.push(await uploadOneToFalCdn(compressed));
  }

  if (!out.length) throw new Error("no_images_prepared");
  return out;
}
