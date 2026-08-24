/**
 * Photo lookbook (.sca) extras — wizard session + vaults for recent restore.
 */

import {
  listTrainedVault,
  listUploadVault,
  replaceTrainedVault,
  replaceUploadVault,
  type PhotoVaultItem,
} from "@/lib/photoVaultStorage";
import { mergeVaultItems } from "@/lib/studioStore/merge";
import { pageBackgroundUrl } from "@/lib/printWizardBg";
import {
  photoToBox,
  type PrintPhotoLayer,
} from "@/lib/printWizardPhotoLayers";
import type { PrintWizardState } from "@/lib/printWizardTypes";
import { resolvePrintAspect } from "@/lib/printWizardTypes";

export const PHOTO_LOOKBOOK_SNAPSHOT_VERSION = 1 as const;

export type PhotoLookbookSnapshot = {
  version: typeof PHOTO_LOOKBOOK_SNAPSHOT_VERSION;
  wizard: PrintWizardState;
  uploadVault: PhotoVaultItem[];
  trainedVault: PhotoVaultItem[];
};

export function capturePhotoLookbookSnapshot(
  wizard: PrintWizardState
): PhotoLookbookSnapshot {
  return {
    version: PHOTO_LOOKBOOK_SNAPSHOT_VERSION,
    wizard: JSON.parse(JSON.stringify(wizard)) as PrintWizardState,
    uploadVault: listUploadVault(),
    trainedVault: listTrainedVault(),
  };
}

export function isPhotoLookbookSnapshot(
  raw: unknown
): raw is PhotoLookbookSnapshot {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return (
    o.version === PHOTO_LOOKBOOK_SNAPSHOT_VERSION &&
    Boolean(o.wizard) &&
    typeof o.wizard === "object" &&
    Array.isArray(o.uploadVault) &&
    Array.isArray(o.trainedVault)
  );
}

export function applyPhotoLookbookSnapshot(snapshot: PhotoLookbookSnapshot): {
  wizard: PrintWizardState;
} {
  const upload = mergeVaultItems(listUploadVault(), snapshot.uploadVault ?? []);
  const trained = mergeVaultItems(listTrainedVault(), snapshot.trainedVault ?? []);
  if (upload.length) replaceUploadVault(upload);
  if (trained.length) replaceTrainedVault(trained);
  const wizard: PrintWizardState = {
    ...snapshot.wizard,
    wizardStep: 1,
  };
  return { wizard };
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image_load_failed"));
    img.src = src;
  });
}

function drawContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  box: { x: number; y: number; width: number; height: number }
) {
  const ir = img.naturalWidth / Math.max(1, img.naturalHeight);
  const br = box.width / Math.max(1, box.height);
  let dw = box.width;
  let dh = box.height;
  let dx = box.x;
  let dy = box.y;
  if (ir > br) {
    dw = box.width;
    dh = box.width / ir;
    dy = box.y + (box.height - dh) / 2;
  } else {
    dh = box.height;
    dw = box.height * ir;
    dx = box.x + (box.width - dw) / 2;
  }
  ctx.drawImage(img, dx, dy, dw, dh);
}

/** Rasterize current lookbook page (bg plate and/or safe-area photo layers). */
export async function compositePhotoLookbookBlob(opts: {
  state: PrintWizardState;
  pageIndex?: number;
  quality: "standard" | "high";
}): Promise<Blob> {
  const pageIndex = Math.max(0, opts.pageIndex ?? 0);
  const aspect = resolvePrintAspect(opts.state.formatId, opts.state.customSize);
  const stageW = 1080;
  const stageH = Math.max(1, Math.round(stageW / Math.max(aspect, 0.05)));
  const canvas = document.createElement("canvas");
  canvas.width = stageW;
  canvas.height = stageH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");

  ctx.fillStyle = "#0B0F19";
  ctx.fillRect(0, 0, stageW, stageH);

  const bg = pageBackgroundUrl(
    opts.state.backgroundUrls,
    opts.state.backgroundUrl,
    pageIndex
  );
  if (bg) {
    try {
      const img = await loadHtmlImage(bg);
      drawContain(ctx, img, { x: 0, y: 0, width: stageW, height: stageH });
    } catch {
      /* keep fill */
    }
  }

  const layers = opts.state.photoLayersByPage?.[pageIndex] ?? [];
  for (const layer of layers) {
    if (!layer?.src?.trim()) continue;
    try {
      const img = await loadHtmlImage(layer.src);
      const box = photoToBox(layer, stageW, stageH);
      drawContain(ctx, img, box);
    } catch {
      /* skip broken layer */
    }
  }

  const mime = opts.quality === "high" ? "image/png" : "image/jpeg";
  const quality = opts.quality === "high" ? 0.95 : 0.85;
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), mime, quality)
  );
  if (!blob) throw new Error("toBlob_failed");
  return blob;
}

export function photoLookbookHasExportableFrame(state: PrintWizardState): boolean {
  const pageIndex = 0;
  const bg = pageBackgroundUrl(
    state.backgroundUrls,
    state.backgroundUrl,
    pageIndex
  );
  const layers = state.photoLayersByPage?.[pageIndex] ?? [];
  return Boolean(bg) || layers.some((l) => Boolean(l?.src?.trim()));
}
