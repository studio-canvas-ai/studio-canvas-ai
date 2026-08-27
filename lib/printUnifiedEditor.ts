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

/** Canvas zoom presets (layout scale — visibly shrinks/grows the page card). */
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

const UNIFIED_GUIDE_BOX_W = 0.92;
const UNIFIED_GUIDE_BOX_H: Record<SemanticZone, number> = {
  top: 0.1,
  center: 0.14,
  bottom: 0.1,
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
    const boxW = UNIFIED_GUIDE_BOX_W;
    const boxH = UNIFIED_GUIDE_BOX_H[zone] ?? 0.1;
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

/** Screen 26 — wide horizontal guide boxes (top / center / bottom). */
export function applyUnifiedEditorPageLayout(
  layers: TextLayer[],
  pageIndex: number,
  stageW: number,
  stageH: number
): TextLayer[] {
  return applyWideGuideBoxes(
    unifiedEditorBaseLayers(layers, pageIndex),
    stageW,
    stageH
  );
}
