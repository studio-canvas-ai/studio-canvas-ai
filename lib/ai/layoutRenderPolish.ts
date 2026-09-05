/**
 * Canva-like polish for Screen-26 Magic Layout:
 * measure-fit boxes, overlap pack (no bottom pile-up), dark-band cull.
 */

import { hexLuminance, parseFillColor } from "@/lib/ai/textContrastSafety";
import { measurePrintLayerContentHeightPx } from "@/lib/printWizardTextDraw";
import { canvasTextScale } from "@/lib/printWizardTextLayers";
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

function isInfoLikeLayer(layer: TextLayer): boolean {
  return /info|label|value|일시|장소|입장/.test(layer.id || "");
}

/**
 * Sync boxH to measured CJK wrap height so glyphs are not clipped.
 * Returns a new array (shallow-copied layers).
 */
export function refitContentTextBoxes(
  layers: TextLayer[],
  stageW: number,
  stageH: number
): TextLayer[] {
  if (!layers.length || stageW < 8 || stageH < 8) return layers;
  const scale = canvasTextScale(stageW, stageH);
  const next = layers.map((layer) => ({ ...layer }));

  next.forEach((layer) => {
    if (!isContentTextLayer(layer)) return;
    const w = Math.max(
      8,
      (layer.boxW && layer.boxW > 0 ? layer.boxW : 0.4) * stageW
    );
    const measured = measurePrintLayerContentHeightPx(layer, w, scale);
    // Slight slack so descenders / tracking don't clip.
    const h = Math.min(stageH * 0.45, Math.max(measured + 4, 20));
    layer.boxW = w / stageW;
    layer.boxH = h / stageH;
    layer.maxWidth = layer.boxW;
    layer.boxManual = true;
    layer.layoutLocked = true;
  });

  return next;
}

/**
 * Pack overlapping content text down the Y axis using measured heights.
 * Never pile multiple boxes onto the same bottom Y — shift the chain up
 * (and compress gaps slightly) so everything stays on-canvas.
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

  const packPass = (gap: number) => {
    for (let n = 1; n < items.length; n++) {
      const B = items[n]!;
      for (let p = 0; p < n; p++) {
        const A = items[p]!;
        const hOverlap = A.x < B.x + B.w && B.x < A.x + A.w;
        if (!hOverlap) continue;
        const needY = A.y + A.h + gap;
        if (B.y < needY) B.y = needY;
      }
    }
  };

  // Multi-pass downward pack with full min gap.
  for (let pass = 0; pass < 4; pass++) {
    const before = items.map((i) => i.y).join(",");
    packPass(minGapPx);
    if (items.map((i) => i.y).join(",") === before) break;
  }

  // If anything overflows the stage, shift overlapping chains upward.
  const margin = stageH * 0.02;
  for (let n = items.length - 1; n >= 0; n--) {
    const B = items[n]!;
    if (B.y + B.h <= stageH - margin) continue;

    const chain: Item[] = [B];
    for (let p = n - 1; p >= 0; p--) {
      const A = items[p]!;
      const tip = chain[chain.length - 1]!;
      const hOverlap = A.x < tip.x + tip.w && tip.x < A.x + A.w;
      if (!hOverlap) continue;
      if (A.y + A.h + minGapPx * 2 >= tip.y) chain.push(A);
    }
    chain.reverse();

    const totalH =
      chain.reduce((s, it) => s + it.h, 0) +
      Math.max(0, chain.length - 1) * minGapPx;
    const maxBottom = stageH - margin;
    let startY = chain[0]!.y;
    if (startY + totalH > maxBottom) {
      startY = Math.max(margin, maxBottom - totalH);
    }
    let gap = minGapPx;
    if (startY + totalH > maxBottom) {
      const avail = Math.max(
        0,
        maxBottom - startY - chain.reduce((s, it) => s + it.h, 0)
      );
      gap =
        chain.length > 1
          ? Math.max(6, Math.min(minGapPx, avail / (chain.length - 1)))
          : minGapPx;
      startY = Math.max(
        margin,
        maxBottom -
          (chain.reduce((s, it) => s + it.h, 0) +
            Math.max(0, chain.length - 1) * gap)
      );
    }
    let y = startY;
    for (const it of chain) {
      it.y = y;
      y += it.h + gap;
    }
  }

  // Final safety: never share the exact same y for X-overlapping boxes.
  packPass(Math.max(6, Math.min(minGapPx, 12)));
  for (const item of items) {
    if (item.y + item.h > stageH) {
      item.y = Math.max(0, stageH - item.h);
    }
    if (item.y < 0) item.y = 0;
  }

  const next = layers.map((layer) => ({ ...layer }));
  for (const item of items) {
    const layer = next[item.index]!;
    layer.manualY = item.y / stageH;
    layer.boxH = item.h / stageH;
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
  if (lum > 0.42 || opacity < 0.22) return false;

  const cx = plate.x + plate.w / 2;
  const cy = plate.y + plate.h / 2;
  const centeredX = Math.abs(cx - stageW / 2) < stageW * 0.22;
  const centeredY = Math.abs(cy - stageH / 2) < stageH * 0.28;
  const area = plate.w * plate.h;
  const stageArea = stageW * stageH;

  if (
    centeredX &&
    plate.h >= stageH * 0.32 &&
    plate.w >= stageW * 0.1 &&
    plate.w <= stageW * 0.58 &&
    opacity >= 0.28
  ) {
    return true;
  }

  if (
    centeredY &&
    plate.w >= stageW * 0.4 &&
    plate.h >= stageH * 0.07 &&
    plate.h <= stageH * 0.48 &&
    opacity >= 0.28
  ) {
    return true;
  }

  if (area >= stageArea * 0.28 && opacity >= 0.35 && lum <= 0.35) {
    return true;
  }

  return false;
}

/**
 * Soften dark photo veils; keep light info panels opaque enough for type.
 * Must stay ≥ contrast backdrop gate (0.22) so box-local contrast still runs.
 */
export function cappedPlateOpacity(
  fill: string | undefined,
  opacity: number
): number {
  const parsed = parseFillColor(fill);
  if (!parsed) return Math.min(1, Math.max(0, opacity));
  const lum = hexLuminance(parsed.hex);
  if (lum > 0.45) {
    return Math.max(0.78, Math.min(1, opacity <= 0 ? 0.88 : opacity));
  }
  return Math.min(0.32, Math.max(0.24, opacity));
}

/**
 * Soft-snap content text into Canva bands (top / mid / bottom).
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
      (isInfoLikeLayer(layer) || (mid >= topEnd && mid <= midEnd));
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

/**
 * Grow light plates so they still cover fitted content (readable zone).
 */
export function expandPlatesUnderContent(
  layers: TextLayer[],
  stageW: number,
  stageH: number
): TextLayer[] {
  if (!layers.length) return layers;
  const next = layers.map((layer) => ({ ...layer }));
  const plates = next
    .map((layer, index) => ({ layer, index }))
    .filter(({ layer }) => layer.showBox);

  for (const { layer: plate, index: pi } of plates) {
    const px = (plate.manualX ?? 0) * stageW;
    const py = (plate.manualY ?? 0) * stageH;
    const pw = Math.max(8, (plate.boxW ?? 0.3) * stageW);
    const ph = Math.max(8, (plate.boxH ?? 0.1) * stageH);
    const lum = hexLuminance(plate.boxColor || "#000000");
    if (lum <= 0.45) continue;

    let minY = py;
    let maxY = py + ph;
    let hit = false;
    for (const content of next) {
      if (!isContentTextLayer(content)) continue;
      const cx =
        ((content.manualX ?? 0) + (content.boxW ?? 0.2) / 2) * stageW;
      const cy =
        ((content.manualY ?? 0) + (content.boxH ?? 0.04) / 2) * stageH;
      if (cx < px || cx > px + pw) continue;
      if (cy < py - 24 || cy > py + ph + stageH * 0.35) continue;
      hit = true;
      const ty = (content.manualY ?? 0) * stageH;
      const th = Math.max(8, (content.boxH ?? 0.04) * stageH);
      minY = Math.min(minY, ty - 12);
      maxY = Math.max(maxY, ty + th + 12);
    }
    if (!hit) continue;
    minY = Math.max(0, minY);
    maxY = Math.min(stageH, maxY);
    next[pi] = {
      ...plate,
      manualY: minY / stageH,
      boxH: Math.max(ph / stageH, (maxY - minY) / stageH),
      boxManual: true,
      layoutLocked: true,
      boxOpacity: Math.max(0.78, plate.boxOpacity ?? 0.88),
    };
  }
  return next;
}
