/**
 * Canva-like polish for Screen-26 Magic Layout: overlap push, dark-band cull.
 */

import { hexLuminance, parseFillColor } from "@/lib/ai/textContrastSafety";
import type { TextLayer } from "@/lib/thumbnailStyles";

const MIN_TEXT_GAP_PX = 16;

function plainText(layer: TextLayer): string {
  return String(layer.text || "")
    .replace(/\u200B/g, "")
    .trim();
}

/** Real copy layers (not ZWSP showBox plates). */
export function isContentTextLayer(layer: TextLayer): boolean {
  return Boolean(plainText(layer)) && !layer.showBox;
}

/**
 * Push overlapping content text down the Y axis so boxes never collide.
 * Side-by-side info columns (no horizontal overlap) are left alone.
 */
export function resolveOverlappingTextLayers(
  layers: TextLayer[],
  stageW: number,
  stageH: number,
  minGapPx = MIN_TEXT_GAP_PX
): TextLayer[] {
  if (!layers.length || stageW < 8 || stageH < 8) return layers;

  type Item = { index: number; x: number; y: number; w: number; h: number };
  const items: Item[] = [];
  layers.forEach((layer, index) => {
    if (!isContentTextLayer(layer)) return;
    const x = (layer.manualX ?? 0) * stageW;
    const y = (layer.manualY ?? 0) * stageH;
    const w = Math.max(8, (layer.boxW ?? 0.4) * stageW);
    const h = Math.max(8, (layer.boxH ?? 0.04) * stageH);
    items.push({ index, x, y, w, h });
  });
  if (items.length < 2) return layers;

  items.sort((a, b) => a.y - b.y || a.x - b.x);

  // Multi-pass: later boxes yield to all earlier ones they collide with.
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (let n = 1; n < items.length; n++) {
      const B = items[n]!;
      for (let p = 0; p < n; p++) {
        const A = items[p]!;
        const hOverlap = A.x < B.x + B.w && B.x < A.x + A.w;
        if (!hOverlap) continue;
        const needY = A.y + A.h + minGapPx;
        if (B.y < needY) {
          B.y = needY;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }

  const next = layers.map((layer) => ({ ...layer }));
  for (const item of items) {
    const layer = next[item.index]!;
    let y = item.y;
    const h = item.h;
    if (y + h > stageH) {
      y = Math.max(0, stageH - h);
    }
    layer.manualY = y / stageH;
    layer.boxH = h / stageH;
    layer.boxManual = true;
    layer.layoutLocked = true;
  }
  return next;
}

export type PlateLike = {
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
  circle?: boolean;
};

/**
 * Drop dark center columns / mid bars / large veils that smother photo + type
 * (Canva-style: prefer open negative space over opaque overlay slabs).
 */
export function isObscuringDarkOverlay(
  plate: PlateLike,
  stageW: number,
  stageH: number
): boolean {
  if (plate.circle) return false;
  const parsed = parseFillColor(plate.fill);
  if (!parsed) return false;
  const lum = hexLuminance(parsed.hex);
  const opacity = parsed.opacity;
  // Keep light panels and faint tints.
  if (lum > 0.42 || opacity < 0.22) return false;

  const cx = plate.x + plate.w / 2;
  const cy = plate.y + plate.h / 2;
  const centeredX = Math.abs(cx - stageW / 2) < stageW * 0.22;
  const centeredY = Math.abs(cy - stageH / 2) < stageH * 0.28;
  const area = plate.w * plate.h;
  const stageArea = stageW * stageH;

  // Tall dark column through the middle.
  if (
    centeredX &&
    plate.h >= stageH * 0.32 &&
    plate.w >= stageW * 0.1 &&
    plate.w <= stageW * 0.58 &&
    opacity >= 0.28
  ) {
    return true;
  }

  // Wide dark horizontal belt across content.
  if (
    centeredY &&
    plate.w >= stageW * 0.4 &&
    plate.h >= stageH * 0.07 &&
    plate.h <= stageH * 0.48 &&
    opacity >= 0.28
  ) {
    return true;
  }

  // Large dark veil.
  if (area >= stageArea * 0.28 && opacity >= 0.35 && lum <= 0.35) {
    return true;
  }

  return false;
}

/** Soften remaining dark plates so they never dominate the photo. */
export function cappedPlateOpacity(
  fill: string | undefined,
  opacity: number
): number {
  const parsed = parseFillColor(fill);
  if (!parsed) return Math.min(1, Math.max(0, opacity));
  if (hexLuminance(parsed.hex) > 0.45) return Math.min(1, Math.max(0, opacity));
  return Math.min(0.28, Math.max(0, opacity));
}

/**
 * Soft-snap content text into Canva bands (top / mid / bottom) without
 * collapsing side-by-side info columns.
 */
export function snapTextLayersToSectionBands(
  layers: TextLayer[],
  stageW: number,
  stageH: number
): TextLayer[] {
  if (!layers.length || stageH < 8) return layers;
  const topEnd = stageH * 0.32;
  const midEnd = stageH * 0.68;
  const next = layers.map((layer) => ({ ...layer }));

  next.forEach((layer) => {
    if (!isContentTextLayer(layer)) return;
    const y = (layer.manualY ?? 0) * stageH;
    const h = Math.max(8, (layer.boxH ?? 0.04) * stageH);
    const mid = y + h / 2;
    const fs = layer.fontSize || 24;
    const plain = plainText(layer);
    const looksTitle =
      fs >= 44 ||
      mid < topEnd ||
      (plain.length <= 36 && mid < stageH * 0.4 && fs >= 36);
    const looksBottom =
      mid > midEnd ||
      /guide|cta|caption|안내|문의|티켓/.test(layer.id || "");
    const looksInfo =
      !looksTitle &&
      !looksBottom &&
      (/info|label|value|일시|장소|입장/.test(layer.id || "") ||
        (mid >= topEnd && mid <= midEnd));
    let bandTop = 0;
    let bandBottom = stageH;
    if (looksTitle) {
      bandTop = stageH * 0.04;
      bandBottom = topEnd;
    } else if (looksBottom) {
      bandTop = midEnd + 8;
      bandBottom = stageH * 0.96;
    } else if (looksInfo) {
      bandTop = topEnd + 8;
      bandBottom = midEnd;
    } else {
      bandTop = midEnd + 8;
      bandBottom = stageH * 0.96;
    }
    let ny = y;
    if (ny < bandTop) ny = bandTop;
    if (ny + h > bandBottom) ny = Math.max(bandTop, bandBottom - h);
    layer.manualY = ny / stageH;
    layer.boxManual = true;
    layer.layoutLocked = true;
    void stageW;
  });
  return next;
}
