/**
 * Add a user photo as a new independent canvas layer (never replaces planes).
 */

import { processSubjectViaApi, toRawImageUrl } from "@/lib/aiCommand";
import { useCanvasStore } from "@/lib/canvas/canvasStore";
import {
  defaultImageObject,
  fitImageInStage,
  newCanvasObjectId,
  type CanvasImageObject,
} from "@/lib/canvas/types";
import { toDisplayImageSrc } from "@/lib/resultSession";

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("read_failed"));
    };
    reader.onerror = () => reject(new Error("read_failed"));
    reader.readAsDataURL(file);
  });
}

export function loadImageNaturalSize(
  src: string
): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () =>
      resolve({
        w: Math.max(1, img.naturalWidth || img.width),
        h: Math.max(1, img.naturalHeight || img.height),
      });
    img.onerror = () => reject(new Error("image_load_failed"));
    img.src = src;
  });
}

export type PhotoKind = "original" | "cutout";

function toLayerDisplaySrc(src: string, photoKind: PhotoKind): string {
  const t = src.trim();
  if (photoKind === "cutout" && /^https?:\/\//i.test(t)) {
    return toDisplayImageSrc(t);
  }
  return t;
}

export type AddPhotoLayerResult = {
  object: CanvasImageObject;
};

export type AddPhotoLayerOptions = {
  stackOffset?: number;
  photoKind?: PhotoKind;
  /** Clear prior image/photo layers before adding (default true). */
  replaceMain?: boolean;
  /** Contain fraction of stage (1 = full Center & Fit). */
  maxFraction?: number;
};

/**
 * Push a photo object from an already-resolved image URL / data URL.
 */
export async function addPhotoLayerFromSrc(
  src: string,
  opts?: AddPhotoLayerOptions
): Promise<AddPhotoLayerResult> {
  const photoKind = opts?.photoKind ?? "original";
  const replaceMain = opts?.replaceMain !== false;
  const maxFraction = opts?.maxFraction ?? 1;
  const trimmed = toLayerDisplaySrc(src, photoKind);
  if (!trimmed) throw new Error("empty_src");

  const store = useCanvasStore.getState();
  if (replaceMain) {
    store.clearImageLayers();
  }

  const natural = await loadImageNaturalSize(trimmed);
  const stageW = Math.max(1, store.meta.width || 1080);
  const stageH = Math.max(1, store.meta.height || 1350);
  const fitted = fitImageInStage(
    natural.w,
    natural.h,
    stageW,
    stageH,
    maxFraction
  );
  const photoCount = store.objects.filter((o) => o.type === "photo").length;
  const jitter =
    replaceMain || maxFraction >= 0.99
      ? 0
      : (opts?.stackOffset ?? photoCount) * 18;
  const maxZ = store.objects.reduce((m, o) => Math.max(m, o.zIndex), 0);

  const object = defaultImageObject({
    id: newCanvasObjectId("photo"),
    type: "photo",
    src: trimmed,
    photoKind,
    x: fitted.x + jitter,
    y: fitted.y + jitter,
    width: fitted.width,
    height: fitted.height,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    zIndex: maxZ + 1,
    locked: false,
  });

  store.upsertObject(object);
  store.select(object.id);
  return { object };
}

/**
 * Push a new photo layer from a local file.
 * - original: keep background pixels (for inpaint pipelines)
 * - cutout: run RemoveBG API first, then add transparent subject layer
 */
export async function addPhotoLayerFromFile(
  file: File,
  opts?: AddPhotoLayerOptions & { mode?: PhotoKind }
): Promise<AddPhotoLayerResult> {
  if (!file.type.startsWith("image/")) {
    throw new Error("image_only");
  }
  const photoKind = opts?.mode ?? opts?.photoKind ?? "original";
  const dataUrl = await readFileAsDataUrl(file);

  if (photoKind === "cutout") {
    const cutoutHttps = await processSubjectViaApi(toRawImageUrl(dataUrl));
    return addPhotoLayerFromSrc(cutoutHttps, {
      ...opts,
      photoKind: "cutout",
      replaceMain: opts?.replaceMain !== false,
      maxFraction: opts?.maxFraction ?? 1,
    });
  }

  return addPhotoLayerFromSrc(dataUrl, {
    ...opts,
    photoKind: "original",
    replaceMain: opts?.replaceMain !== false,
    maxFraction: opts?.maxFraction ?? 1,
  });
}
