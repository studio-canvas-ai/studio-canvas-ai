/**
 * Flatten one print-wizard / lookbook page to a raster blob (bg + photos + text + deco).
 */

import { pageBackgroundUrl } from "@/lib/printWizardBg";
import {
  decoToBox,
  isRenderableDecoLayer,
} from "@/lib/printWizardDecoLayers";
import { drawDecoLayerOnCanvas } from "@/lib/printWizardCompositeDeco";
import { photoToBox } from "@/lib/printWizardPhotoLayers";
import { drawPrintLayerInBox } from "@/lib/printWizardTextDraw";
import {
  canvasTextScale,
  layerToBox,
  resolvePageTextLayersForExport,
} from "@/lib/printWizardTextLayers";
import {
  resolvePrintAspect,
  type PrintWizardState,
} from "@/lib/printWizardTypes";

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

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  box: { x: number; y: number; width: number; height: number },
  pan?: { x: number; y: number } | null
) {
  const ir = img.naturalWidth / Math.max(1, img.naturalHeight);
  const br = box.width / Math.max(1, box.height);
  let dw = box.width;
  let dh = box.height;
  if (ir > br) {
    dh = box.height;
    dw = box.height * ir;
  } else {
    dw = box.width;
    dh = box.width / ir;
  }
  const maxOx = Math.max(0, (dw - box.width) / 2);
  const maxOy = Math.max(0, (dh - box.height) / 2);
  const px = Math.max(-1, Math.min(1, pan?.x ?? 0));
  const py = Math.max(-1, Math.min(1, pan?.y ?? 0));
  const dx = box.x - maxOx + px * maxOx;
  const dy = box.y - maxOy + py * maxOy;
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.width, box.height);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

/** Rasterize current wizard page (bg + photos + text + deco symbols). */
export async function compositePrintWizardPageBlob(opts: {
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
      const pan = opts.state.backgroundPansByPage?.[pageIndex] ?? null;
      drawCover(ctx, img, { x: 0, y: 0, width: stageW, height: stageH }, pan);
    } catch {
      /* keep fill */
    }
  }

  const photoLayers = opts.state.photoLayersByPage?.[pageIndex] ?? [];
  for (const layer of photoLayers) {
    if (!layer?.src?.trim()) continue;
    try {
      const img = await loadHtmlImage(layer.src);
      const box = photoToBox(layer, stageW, stageH);
      drawContain(ctx, img, box);
    } catch {
      /* skip broken layer */
    }
  }

  const textScale = canvasTextScale(stageW, stageH);
  const textLayers = resolvePageTextLayersForExport(
    opts.state.textLayersByPage,
    pageIndex,
    opts.state.inputs,
    opts.state.pageCount || 1
  );
  for (const layer of textLayers) {
    const visible = String(layer?.text || "").replace(/\u200B/g, "").trim();
    if (!visible && !layer?.showBox) continue;
    const box = layerToBox(layer, stageW, stageH);
    ctx.save();
    ctx.translate(box.x, box.y);
    drawPrintLayerInBox(ctx, layer, box.width, box.height, textScale);
    ctx.restore();
  }

  const decoLayers = opts.state.decoLayersByPage?.[pageIndex] ?? [];
  for (const layer of decoLayers) {
    if (!isRenderableDecoLayer(layer)) continue;
    // Catalog SVG deco still exports via symbol/catalog path below when present.
    if (layer.decoId && !layer.symbol && !layer.lucideIcon && !layer.shapeType) {
      continue;
    }
    const box = decoToBox(layer, stageW, stageH);
    await drawDecoLayerOnCanvas(ctx, layer, box);
  }

  const mime = opts.quality === "high" ? "image/png" : "image/jpeg";
  const quality = opts.quality === "high" ? 0.95 : 0.85;
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), mime, quality)
  );
  if (!blob) throw new Error("toBlob_failed");
  return blob;
}

export function printWizardHasExportableFrame(
  state: PrintWizardState,
  pageIndex = 0
): boolean {
  const idx = Math.max(0, Math.floor(pageIndex));
  const bg = pageBackgroundUrl(
    state.backgroundUrls,
    state.backgroundUrl,
    idx
  );
  const photos = state.photoLayersByPage?.[idx] ?? [];
  const texts = resolvePageTextLayersForExport(
    state.textLayersByPage,
    idx,
    state.inputs,
    state.pageCount || 1
  );
  const decos = state.decoLayersByPage?.[idx] ?? [];
  return (
    Boolean(bg) ||
    photos.some((l) => Boolean(l?.src?.trim())) ||
    texts.some(
      (l) =>
        Boolean(l?.showBox) ||
        Boolean(String(l?.text || "").replace(/\u200B/g, "").trim())
    ) ||
    decos.some((l) => isRenderableDecoLayer(l))
  );
}
