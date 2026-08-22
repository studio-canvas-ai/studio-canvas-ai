/**
 * ID-photo lookbook: lock uploaded subject silhouette; replace background only.
 * Never text-to-image a new person from a color/background prompt.
 */

import { prepareGenerateImageUrls } from "@/lib/prepareGenerateImages";
import { toRawImageUrl, processSubjectViaApi } from "@/lib/aiCommand";

export const ID_PHOTO_STYLE_ID = "id-photo-studio";

/** Flux / prompt lock when ID photo use + style are active. */
export const ID_PHOTO_STUDIO_LOCK =
  "Professional studio ID photo, clean solid color background, studio soft lighting. Preserve the exact original person face, facial features, hair, and upper-body silhouette — do not invent a new person.";

export function isIdPhotoLookbookMode(opts: {
  useId?: string | null;
  imageStyleId?: string | null;
}): boolean {
  return (
    opts.useId === "id-photo" || opts.imageStyleId === ID_PHOTO_STYLE_ID
  );
}

/**
 * Parse solid studio backdrop color from Korean/English prompts.
 * Returns CSS hex or null if not a solid-color request.
 */
export function parseIdPhotoBackgroundColor(prompt: string): string | null {
  const raw = prompt.trim();
  if (!raw) return null;
  const p = raw.toLowerCase().replace(/\s+/g, "");

  const hex = raw.match(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/);
  if (hex) {
    const h = hex[1];
    if (h.length === 3) {
      return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toUpperCase();
    }
    return `#${h.toUpperCase()}`;
  }

  if (/(흰|백색|화이트|white|밝힌)/i.test(p)) return "#FFFFFF";
  if (/(하늘|스카이|skyblue|라이트블루|연파)/i.test(p)) return "#87CEEB";
  if (/(파란|청색|블루|blue|남색)/i.test(p)) return "#4A90D9";
  if (/(회|그레이|gray|grey)/i.test(p)) return "#E5E7EB";
  if (/(검|블랙|black)/i.test(p)) return "#111827";
  if (/(빨간|레드|red)/i.test(p)) return "#DC2626";
  if (/(초록|그린|green)/i.test(p)) return "#16A34A";
  if (/(베이지|beige)/i.test(p)) return "#F5F0E8";
  // Generic “solid backdrop” → default ID-photo white
  if (
    /(바탕배경|단색배경|솔리드|solidcolor|단색)/i.test(p) ||
    p === "바탕" ||
    /(배경만|배경색)/i.test(p)
  ) {
    return "#FFFFFF";
  }
  return null;
}

/** True when background should be a flat studio plate (parsed solid color). */
export function shouldUseSolidIdBackground(opts: {
  useId?: string | null;
  imageStyleId?: string | null;
  bgPrompt: string;
}): boolean {
  return Boolean(parseIdPhotoBackgroundColor(opts.bgPrompt));
}

export function createSolidBackgroundDataUrl(
  color: string,
  width = 1080,
  height = 1440
): string {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(512, Math.round(width));
  canvas.height = Math.max(512, Math.round(height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  ctx.fillStyle = color.startsWith("#") ? color : `#${color}`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.95);
}

/** Upload solid color plate → https URL for canvas plate. */
export async function createSolidBackgroundHttps(opts: {
  color: string;
  width?: number;
  height?: number;
}): Promise<string> {
  const dataUrl = createSolidBackgroundDataUrl(
    opts.color,
    opts.width,
    opts.height
  );
  const [url] = await prepareGenerateImageUrls([dataUrl], { maxImages: 1 });
  if (!url?.trim()) throw new Error("solid_bg_upload_failed");
  return url.trim();
}

/**
 * Lock original person: rembg the uploaded/trained identity only.
 * Never run edit_image / T2I with a background-color prompt.
 */
export async function cutoutOriginalIdentityOnly(
  identitySrc: string
): Promise<string> {
  return processSubjectViaApi(toRawImageUrl(identitySrc));
}
