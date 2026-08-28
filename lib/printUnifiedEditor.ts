import {
  PAGE_ZONE_ORDER,
  applySemanticPageLayout,
  createPlaceholderLayer,
  layerZone,
  printSafeInsetPx,
  stackLayersInZones,
  type SemanticZone,
} from "@/lib/printWizardTextLayers";
import type { TextLayer } from "@/lib/thumbnailStyles";

/** Screen 26 — one-page unified print editor (independent from Screen 8 / 24 wizard). */
export const PRINT_UNIFIED_EDITOR_PATH = "/print-unified-editor";

export const PRINT_UNIFIED_EDITOR_SESSION_KEY = "sca_print_unified_v1";

export const PRINT_UNIFIED_EDITOR_SCREEN_ID = "SCREEN-026";

/** Canvas zoom presets — applied as transform:scale on the shared stage world. */
export const PRINT_UNIFIED_ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5] as const;

export type PrintUnifiedZoom = (typeof PRINT_UNIFIED_ZOOM_LEVELS)[number];

export function clampUnifiedZoom(value: number): PrintUnifiedZoom {
  const sorted = [...PRINT_UNIFIED_ZOOM_LEVELS];
  let best = sorted[0]!;
  let bestDist = Math.abs(value - best);
  for (const z of sorted) {
    const d = Math.abs(value - z);
    if (d < bestDist) {
      best = z;
      bestDist = d;
    }
  }
  return best;
}

export function nextUnifiedZoom(
  current: PrintUnifiedZoom,
  dir: 1 | -1
): PrintUnifiedZoom {
  const idx = PRINT_UNIFIED_ZOOM_LEVELS.indexOf(current);
  const next = Math.max(
    0,
    Math.min(PRINT_UNIFIED_ZOOM_LEVELS.length - 1, idx + dir)
  );
  return PRINT_UNIFIED_ZOOM_LEVELS[next] ?? current;
}

/** Free stage-world pan in CSS pixels (translate after scale). Unclamped. */
export type PrintContentOffset = { x: number; y: number };

export const DEFAULT_CONTENT_OFFSET: PrintContentOffset = { x: 0, y: 0 };

export function normalizeContentOffset(
  offset?: Partial<PrintContentOffset> | null
): PrintContentOffset {
  const x =
    typeof offset?.x === "number" && Number.isFinite(offset.x) ? offset.x : 0;
  const y =
    typeof offset?.y === "number" && Number.isFinite(offset.y) ? offset.y : 0;
  return { x, y };
}

export function resizeContentOffsets(
  prev: PrintContentOffset[] | undefined,
  pageCount: number
): PrintContentOffset[] {
  const out: PrintContentOffset[] = [];
  for (let i = 0; i < pageCount; i++) {
    out.push(normalizeContentOffset(prev?.[i]));
  }
  return out;
}

const UNIFIED_GUIDE_BOX_W = 0.92 * 0.8; // ~80% of prior width
const UNIFIED_GUIDE_BOX_H: Record<SemanticZone, number> = {
  top: 0.1 * 0.5,
  center: 0.14 * 0.5,
  bottom: 0.1 * 0.5,
};

function unifiedEditorBaseLayers(
  layers: TextLayer[],
  pageIndex: number
): TextLayer[] {
  if (pageIndex === 0) {
    return applySemanticPageLayout(layers, pageIndex);
  }
  if (layers.some((l) => l.text.trim())) {
    return applySemanticPageLayout(layers, pageIndex);
  }
  // Keep existing empty layers (drag coords / ids). Only seed when empty.
  if (layers.length > 0) {
    // Ensure top/center/bottom zone anchors without wiping geometry.
    return PAGE_ZONE_ORDER.map((zone, slot) => {
      const existing = layers[slot];
      if (existing) {
        return {
          ...existing,
          pos: existing.pos || zone,
        };
      }
      return createPlaceholderLayer(pageIndex, slot);
    });
  }
  const zones = PAGE_ZONE_ORDER.map((_, slot) =>
    createPlaceholderLayer(pageIndex, slot)
  );
  return stackLayersInZones(zones);
}

function applyWideGuideBoxes(
  layers: TextLayer[],
  stageW: number,
  stageH: number
): TextLayer[] {
  const inset = printSafeInsetPx(stageW, stageH);
  return layers.map((layer) => {
    if (layer.text.trim()) return layer;

    const zone = layerZone(layer);
    const defaultW = UNIFIED_GUIDE_BOX_W;
    const defaultH = UNIFIED_GUIDE_BOX_H[zone] ?? 0.05;

    // Preserve user-dragged / resized guide geometry (page 2+ snap-back + top-handle).
    if (
      layer.boxManual &&
      typeof layer.manualX === "number" &&
      Number.isFinite(layer.manualX) &&
      typeof layer.manualY === "number" &&
      Number.isFinite(layer.manualY)
    ) {
      const boxW =
        typeof layer.boxW === "number" && layer.boxW > 0
          ? layer.boxW
          : defaultW;
      const boxH =
        typeof layer.boxH === "number" && layer.boxH > 0
          ? layer.boxH
          : defaultH;
      return {
        ...layer,
        layoutLocked: true,
        boxManual: true,
        boxW,
        boxH,
        maxWidth: boxW,
        align: "center" as const,
      };
    }

    const boxW = defaultW;
    const boxH = defaultH;
    const widthPx = boxW * stageW;
    const heightPx = boxH * stageH;
    const x = (stageW - widthPx) / 2;
    let y =
      zone === "top"
        ? inset
        : zone === "center"
          ? (stageH - heightPx) / 2
          : stageH - heightPx - inset;
    y += (layer.offsetY || 0) * stageH;

    return {
      ...layer,
      layoutLocked: true,
      boxManual: true,
      boxW,
      boxH,
      manualX: x / stageW,
      manualY: y / stageH,
      maxWidth: boxW,
      align: "center" as const,
    };
  });
}

/** True when the page has no user text and is safe to (re)seed guide boxes. */
export function isBlankUnifiedTextPage(layers: TextLayer[]): boolean {
  if (!layers.length) return true;
  if (
    layers.some(
      (layer) => Boolean(String(layer.text || "").replace(/\u200B/g, "").trim())
    )
  ) {
    return false;
  }
  // Warehouse templates use filled boxes or multi-layer layouts — never re-seed.
  if (layers.some((layer) => layer.showBox)) return false;
  if (layers.length > PAGE_ZONE_ORDER.length) return false;
  return true;
}

/** Seed Screen 24–style top / center / bottom wide dashed guide boxes. */
export function createDefaultUnifiedGuideLayers(
  pageIndex: number,
  stageW: number,
  stageH: number
): TextLayer[] {
  return applyUnifiedEditorPageLayout([], pageIndex, stageW, stageH);
}

export function ensureUnifiedGuideLayers(
  layers: TextLayer[],
  pageIndex: number,
  stageW: number,
  stageH: number
): TextLayer[] {
  if (!isBlankUnifiedTextPage(layers)) return layers;
  return createDefaultUnifiedGuideLayers(pageIndex, stageW, stageH);
}

/** Warehouse / boxed templates — every layer carries absolute normalized geometry. */
export function isAbsoluteWarehouseLayoutPage(layers: TextLayer[]): boolean {
  if (!layers.length) return false;
  return layers.every(
    (layer) =>
      layer.layoutLocked &&
      layer.boxManual &&
      typeof layer.manualX === "number" &&
      Number.isFinite(layer.manualX) &&
      typeof layer.manualY === "number" &&
      Number.isFinite(layer.manualY) &&
      typeof layer.boxW === "number" &&
      layer.boxW > 0 &&
      typeof layer.boxH === "number" &&
      layer.boxH > 0
  );
}

/** Screen 26 — wide horizontal guide boxes (top / center / bottom). */
export function applyUnifiedEditorPageLayout(
  layers: TextLayer[],
  pageIndex: number,
  stageW: number,
  stageH: number
): TextLayer[] {
  if (isAbsoluteWarehouseLayoutPage(layers)) {
    return layers;
  }
  return applyWideGuideBoxes(
    unifiedEditorBaseLayers(layers, pageIndex),
    stageW,
    stageH
  );
}

/**
 * Screen 26 page isolation: pad to `pageCount` with empty arrays.
 * Never seed default zone placeholders onto idle faces (unlike
 * `resizeIndependentPages`, which fills every missing page).
 */
export function resizeBlankIsolatedPages(
  prev: TextLayer[][] | undefined,
  pageCount: number
): TextLayer[][] {
  const n = Math.max(0, Math.floor(pageCount));
  const out: TextLayer[][] = [];
  for (let i = 0; i < n; i++) {
    const page = prev?.[i];
    out.push(
      page && page.length > 0 ? page.map((layer) => ({ ...layer })) : []
    );
  }
  return out;
}
