/**
 * Per-page user photos on the print wizard preview.
 * Cutouts auto-trim transparent padding; boxes may sit flush to canvas edges.
 */

import {
  processSubjectViaApi,
  toRawImageUrl,
} from "@/lib/aiCommand";
import {
  loadImageNaturalSize,
  readFileAsDataUrl,
  type PhotoKind,
} from "@/lib/canvas/addPhotoLayer";
import type { PrintPhotoLayer } from "@/lib/printWizardTypes";
import { toDisplayImageSrc } from "@/lib/resultSession";

export type { PrintPhotoLayer };

export const PRINT_PHOTO_ACCEPT =
  "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

export const PRINT_PHOTO_FORMAT_HINT = "(JPG, PNG, WebP)";

const DEFAULT_FRACTION = 0.58;
const STACK_OFFSET_PX = 22;
const PHOTO_MIN_PX = 24;
const ALPHA_OPAQUE = 12;
const TRIM_PAD_PX = 2;

export type PrintPhotoBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PrintPhotoTrim = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export function isAllowedPrintPhotoFile(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  if (
    type === "image/jpeg" ||
    type === "image/jpg" ||
    type === "image/png" ||
    type === "image/webp"
  ) {
    return true;
  }
  return /\.(jpe?g|png|webp)$/i.test(file.name);
}

function newPhotoId(): string {
  return `photo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Photos may hang off the canvas frame; keep a sliver grabable. */
export function clampPhotoBoxToStage(
  box: PrintPhotoBox,
  stageW: number,
  stageH: number
): PrintPhotoBox {
  const maxEdge = Math.max(stageW, stageH, 1) * 3;
  const width = Math.min(Math.max(PHOTO_MIN_PX, box.width), maxEdge);
  const height = Math.min(Math.max(PHOTO_MIN_PX, box.height), maxEdge);
  const minKeep = Math.min(28, width, height, stageW, stageH);
  const x = Math.max(minKeep - width, Math.min(box.x, stageW - minKeep));
  const y = Math.max(minKeep - height, Math.min(box.y, stageH - minKeep));
  return { x, y, width, height };
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image_load_failed"));
    img.src = src;
  });
}

function normalizeTrim(
  raw: Partial<PrintPhotoTrim> | null | undefined
): PrintPhotoTrim | undefined {
  if (!raw) return undefined;
  const x = Number(raw.x);
  const y = Number(raw.y);
  const w = Number(raw.w);
  const h = Number(raw.h);
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(w) ||
    !Number.isFinite(h)
  ) {
    return undefined;
  }
  const nx = Math.min(1, Math.max(0, x));
  const ny = Math.min(1, Math.max(0, y));
  const nw = Math.min(1 - nx, Math.max(0.004, w));
  const nh = Math.min(1 - ny, Math.max(0.004, h));
  if (nw >= 0.98 && nh >= 0.98 && nx <= 0.01 && ny <= 0.01) return undefined;
  return { x: nx, y: ny, w: nw, h: nh };
}

/**
 * Detect the opaque silhouette and return a tight trim rect (0–1 of source).
 */
export async function measureOpaqueTrim(
  src: string
): Promise<PrintPhotoTrim | undefined> {
  try {
    const img = await loadImageElement(src);
    const natW = Math.max(1, img.naturalWidth || img.width);
    const natH = Math.max(1, img.naturalHeight || img.height);
    const canvas = document.createElement("canvas");
    canvas.width = natW;
    canvas.height = natH;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return undefined;
    ctx.drawImage(img, 0, 0);
    let data: ImageData;
    try {
      data = ctx.getImageData(0, 0, natW, natH);
    } catch {
      return undefined;
    }
    const px = data.data;
    let minX = natW;
    let minY = natH;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < natH; y++) {
      const row = y * natW * 4;
      for (let x = 0; x < natW; x++) {
        if (px[row + x * 4 + 3] > ALPHA_OPAQUE) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX || maxY < minY) return undefined;
    minX = Math.max(0, minX - TRIM_PAD_PX);
    minY = Math.max(0, minY - TRIM_PAD_PX);
    maxX = Math.min(natW - 1, maxX + TRIM_PAD_PX);
    maxY = Math.min(natH - 1, maxY + TRIM_PAD_PX);
    return normalizeTrim({
      x: minX / natW,
      y: minY / natH,
      w: (maxX - minX + 1) / natW,
      h: (maxY - minY + 1) / natH,
    });
  } catch {
    return undefined;
  }
}

export function contentSizeForPhoto(
  natW: number,
  natH: number,
  trim?: PrintPhotoTrim
): { w: number; h: number } {
  if (!trim) return { w: Math.max(1, natW), h: Math.max(1, natH) };
  return {
    w: Math.max(1, natW * trim.w),
    h: Math.max(1, natH * trim.h),
  };
}

export function fitPhotoInSafeArea(
  natW: number,
  natH: number,
  stageW: number,
  stageH: number,
  stackIndex = 0,
  fraction = DEFAULT_FRACTION
): PrintPhotoBox {
  const maxW = Math.max(PHOTO_MIN_PX, stageW * fraction);
  const maxH = Math.max(PHOTO_MIN_PX, stageH * fraction);
  const srcW = Math.max(1, natW);
  const srcH = Math.max(1, natH);
  const scale = Math.min(maxW / srcW, maxH / srcH, 1);
  const width = Math.max(PHOTO_MIN_PX, srcW * scale);
  const height = Math.max(PHOTO_MIN_PX, srcH * scale);
  const jitter = stackIndex * STACK_OFFSET_PX;
  return clampPhotoBoxToStage(
    {
      x: (stageW - width) / 2 + jitter,
      y: (stageH - height) / 2 + jitter,
      width,
      height,
    },
    stageW,
    stageH
  );
}

/**
 * Lookbook portrait scale: opaque subject content fills ≥50% of stage height
 * (target ~72%). Upscales small cutouts — never leaves a miniature figure.
 */
export function fitLookbookPortraitSubject(
  natW: number,
  natH: number,
  stageW: number,
  stageH: number,
  opts?: {
    targetHeightFraction?: number;
    minHeightFraction?: number;
    maxWidthFraction?: number;
  }
): PrintPhotoBox {
  const targetHFrac = opts?.targetHeightFraction ?? 0.72;
  const minHFrac = opts?.minHeightFraction ?? 0.5;
  const maxWFrac = opts?.maxWidthFraction ?? 0.88;
  const srcW = Math.max(1, natW);
  const srcH = Math.max(1, natH);

  const targetH = Math.max(PHOTO_MIN_PX, stageH * targetHFrac);
  const minH = Math.max(PHOTO_MIN_PX, stageH * minHFrac);
  const maxW = Math.max(PHOTO_MIN_PX, stageW * maxWFrac);

  // Prefer height target; allow upscale beyond 1 (unlike fitPhotoInSafeArea).
  let scale = targetH / srcH;
  let width = srcW * scale;
  let height = srcH * scale;
  if (width > maxW) {
    scale = maxW / srcW;
    width = srcW * scale;
    height = srcH * scale;
  }
  if (height < minH) {
    scale = minH / srcH;
    width = srcW * scale;
    height = srcH * scale;
    if (width > stageW * 0.98) {
      scale = (stageW * 0.98) / srcW;
      width = srcW * scale;
      height = srcH * scale;
    }
  }

  // Bias slightly lower so feet sit naturally (still centered-ish).
  const x = (stageW - width) / 2;
  const y = Math.max(0, (stageH - height) * 0.42);

  return clampPhotoBoxToStage({ x, y, width, height }, stageW, stageH);
}

/** If subject bbox height &lt; 50% of stage, re-fit to portrait scale. */
export function enforceLookbookSubjectMinScale(
  layer: PrintPhotoLayer,
  stageW: number,
  stageH: number,
  minHeightFraction = 0.5
): PrintPhotoLayer {
  const box = photoToBox(layer, stageW, stageH);
  if (box.height >= stageH * minHeightFraction - 0.5) {
    return layer;
  }
  const fitted = fitLookbookPortraitSubject(
    Math.max(1, box.width),
    Math.max(1, box.height),
    stageW,
    stageH
  );
  return { ...layer, ...boxToPhoto(fitted, stageW, stageH) };
}

export function photoToBox(
  layer: PrintPhotoLayer,
  stageW: number,
  stageH: number
): PrintPhotoBox {
  return clampPhotoBoxToStage(
    {
      x: layer.x * stageW,
      y: layer.y * stageH,
      width: Math.max(PHOTO_MIN_PX, layer.width * stageW),
      height: Math.max(PHOTO_MIN_PX, layer.height * stageH),
    },
    stageW,
    stageH
  );
}

export function boxToPhoto(
  box: PrintPhotoBox,
  stageW: number,
  stageH: number
): Pick<PrintPhotoLayer, "x" | "y" | "width" | "height"> {
  const w = Math.max(1, stageW);
  const h = Math.max(1, stageH);
  const clamped = clampPhotoBoxToStage(box, w, h);
  return {
    x: clamped.x / w,
    y: clamped.y / h,
    width: clamped.width / w,
    height: clamped.height / h,
  };
}

export function resizePhotoPages(
  prev: PrintPhotoLayer[][] | undefined,
  pageCount: number
): PrintPhotoLayer[][] {
  const out: PrintPhotoLayer[][] = [];
  for (let i = 0; i < pageCount; i++) {
    out.push(Array.isArray(prev?.[i]) ? prev[i] : []);
  }
  return out;
}

function isUsablePhotoSrc(src: unknown): src is string {
  if (typeof src !== "string") return false;
  const t = src.trim();
  if (t.length < 8) return false;
  return (
    t.startsWith("data:image/") ||
    t.startsWith("https://") ||
    t.startsWith("http://") ||
    t.startsWith("/")
  );
}

export function sanitizePhotoLayersByPage(
  raw: unknown
): PrintPhotoLayer[][] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const pages: PrintPhotoLayer[][] = [];
  for (const page of raw) {
    if (!Array.isArray(page)) {
      pages.push([]);
      continue;
    }
    const layers: PrintPhotoLayer[] = [];
    for (const item of page) {
      if (!item || typeof item !== "object") continue;
      const obj = item as Record<string, unknown>;
      if (!isUsablePhotoSrc(obj.src)) continue;
      const x = Number(obj.x);
      const y = Number(obj.y);
      const width = Number(obj.width);
      const height = Number(obj.height);
      if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        !Number.isFinite(width) ||
        !Number.isFinite(height)
      ) {
        continue;
      }
      layers.push({
        id:
          typeof obj.id === "string" && obj.id.trim()
            ? obj.id
            : newPhotoId(),
        src: obj.src.trim(),
        photoKind: obj.photoKind === "cutout" ? "cutout" : "original",
        x: Math.min(2.5, Math.max(-1.5, x)),
        y: Math.min(2.5, Math.max(-1.5, y)),
        width: Math.min(4, Math.max(0.04, width)),
        height: Math.min(4, Math.max(0.04, height)),
        trim: normalizeTrim(obj.trim as Partial<PrintPhotoTrim> | undefined),
      });
    }
    pages.push(layers);
  }
  return pages;
}

export async function createPrintPhotoLayerFromFile(
  file: File,
  opts: {
    mode: PhotoKind;
    stageW: number;
    stageH: number;
    stackIndex?: number;
  }
): Promise<PrintPhotoLayer> {
  if (!isAllowedPrintPhotoFile(file)) {
    throw new Error("JPG, PNG, WebP 이미지만 업로드할 수 있습니다.");
  }
  const dataUrl = await readFileAsDataUrl(file);
  let src = dataUrl;
  const photoKind = opts.mode;
  if (photoKind === "cutout") {
    const cutoutHttps = await processSubjectViaApi(toRawImageUrl(dataUrl));
    src = toDisplayImageSrc(cutoutHttps);
  }
  const natural = await loadImageNaturalSize(src);
  const trim =
    photoKind === "cutout" ? await measureOpaqueTrim(src) : undefined;
  const content = contentSizeForPhoto(natural.w, natural.h, trim);
  const box = fitPhotoInSafeArea(
    content.w,
    content.h,
    opts.stageW,
    opts.stageH,
    opts.stackIndex ?? 0
  );
  return {
    id: newPhotoId(),
    src,
    photoKind,
    trim,
    ...boxToPhoto(box, opts.stageW, opts.stageH),
  };
}

/** Build a photo layer from an already-resolved image URL / data URL. */
export async function createPrintPhotoLayerFromSrc(
  srcInput: string,
  opts: {
    mode: PhotoKind;
    stageW: number;
    stageH: number;
    stackIndex?: number;
    id?: string;
    /** Use lookbook portrait scale (≥50% stage height). */
    lookbookPortraitScale?: boolean;
  }
): Promise<PrintPhotoLayer> {
  const src = srcInput.trim();
  if (!src) throw new Error("image_src_empty");
  const photoKind = opts.mode;
  const natural = await loadImageNaturalSize(src);
  const trim =
    photoKind === "cutout" ? await measureOpaqueTrim(src) : undefined;
  const content = contentSizeForPhoto(natural.w, natural.h, trim);
  const box = opts.lookbookPortraitScale
    ? fitLookbookPortraitSubject(
        content.w,
        content.h,
        opts.stageW,
        opts.stageH
      )
    : fitPhotoInSafeArea(
        content.w,
        content.h,
        opts.stageW,
        opts.stageH,
        opts.stackIndex ?? 0
      );
  return {
    id: opts.id || newPhotoId(),
    src,
    photoKind,
    trim,
    ...boxToPhoto(box, opts.stageW, opts.stageH),
  };
}

/**
 * Recompute a photo box so its pixel aspect matches the image (or trim content)
 * inside the current stage — prevents stretch when 규격 / aspect changes.
 */
export async function refitPrintPhotoLayerToStage(
  layer: PrintPhotoLayer,
  stageW: number,
  stageH: number,
  stackIndex = 0
): Promise<PrintPhotoLayer> {
  try {
    const natural = await loadImageNaturalSize(layer.src);
    const content = contentSizeForPhoto(natural.w, natural.h, layer.trim);
    const box = fitPhotoInSafeArea(
      content.w,
      content.h,
      stageW,
      stageH,
      stackIndex
    );
    return {
      ...layer,
      ...boxToPhoto(box, stageW, stageH),
    };
  } catch {
    // Keep previous placement if the image cannot be measured.
    return layer;
  }
}

export async function refitPhotoLayersByPageForAspect(
  pages: PrintPhotoLayer[][] | undefined,
  pageCount: number,
  aspect: number
): Promise<PrintPhotoLayer[][]> {
  const stageW = 1080;
  const stageH = Math.max(1, Math.round(stageW / Math.max(aspect, 0.05)));
  const sized = resizePhotoPages(pages, pageCount);
  return Promise.all(
    sized.map((page) =>
      Promise.all(
        page.map((layer, stackIndex) =>
          refitPrintPhotoLayerToStage(layer, stageW, stageH, stackIndex)
        )
      )
    )
  );
}
