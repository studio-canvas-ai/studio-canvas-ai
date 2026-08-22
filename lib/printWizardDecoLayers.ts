/**
 * Per-page deco layers on the print wizard preview.
 */

import {
  DECO_CATALOG_BY_ID,
  type DecoCatalogItem,
} from "@/lib/printWizardDecoCatalog";
import type { PrintDecoLayer } from "@/lib/printWizardTypes";

export type PrintDecoBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const STACK_OFFSET_PX = 22;
const DECO_MIN_PX = 12;
const SYMBOL_SIZE_FRAC = 0.08;

function newDecoId(): string {
  return `deco_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function isSymbolLayer(layer: PrintDecoLayer): boolean {
  return typeof layer.symbol === "string" && layer.symbol.length > 0;
}

/** Deco boxes may hang off the canvas frame; keep a sliver grabbable. */
export function clampDecoBoxToStage(
  box: PrintDecoBox,
  stageW: number,
  stageH: number
): PrintDecoBox {
  const maxEdge = Math.max(stageW, stageH, 1) * 3;
  const width = Math.min(Math.max(DECO_MIN_PX, box.width), maxEdge);
  const height = Math.min(Math.max(DECO_MIN_PX, box.height), maxEdge);
  const minKeep = Math.min(28, width, height, stageW, stageH);
  const x = Math.max(minKeep - width, Math.min(box.x, stageW - minKeep));
  const y = Math.max(minKeep - height, Math.min(box.y, stageH - minKeep));
  return { x, y, width, height };
}

export function decoToBox(
  layer: PrintDecoLayer,
  stageW: number,
  stageH: number
): PrintDecoBox {
  return clampDecoBoxToStage(
    {
      x: layer.x * stageW,
      y: layer.y * stageH,
      width: Math.max(DECO_MIN_PX, layer.width * stageW),
      height: Math.max(DECO_MIN_PX, layer.height * stageH),
    },
    stageW,
    stageH
  );
}

export function boxToDeco(
  box: PrintDecoBox,
  stageW: number,
  stageH: number
): Pick<PrintDecoLayer, "x" | "y" | "width" | "height"> {
  const w = Math.max(1, stageW);
  const h = Math.max(1, stageH);
  const clamped = clampDecoBoxToStage(box, w, h);
  return {
    x: clamped.x / w,
    y: clamped.y / h,
    width: clamped.width / w,
    height: clamped.height / h,
  };
}

export function defaultDecoBox(
  item: DecoCatalogItem,
  stageW: number,
  stageH: number,
  stackIndex = 0
): PrintDecoBox {
  const w = Math.max(1, stageW);
  const h = Math.max(1, stageH);
  const width = Math.max(DECO_MIN_PX, item.defaultWidthFrac * w);
  const height = Math.max(DECO_MIN_PX, item.defaultHeightFrac * h);
  const jitter = (stackIndex % 5) * STACK_OFFSET_PX;
  return clampDecoBoxToStage(
    {
      x: (w - width) / 2 + jitter * 0.35,
      y: (h - height) / 2 + jitter * 0.25,
      width,
      height,
    },
    w,
    h
  );
}

export function defaultSymbolBox(
  stageW: number,
  stageH: number,
  stackIndex = 0
): PrintDecoBox {
  const w = Math.max(1, stageW);
  const h = Math.max(1, stageH);
  const size = Math.max(DECO_MIN_PX, Math.min(w, h) * SYMBOL_SIZE_FRAC);
  const jitter = (stackIndex % 5) * STACK_OFFSET_PX;
  return clampDecoBoxToStage(
    {
      x: (w - size) / 2 + jitter * 0.35,
      y: (h - size) / 2 + jitter * 0.25,
      width: size,
      height: size,
    },
    w,
    h
  );
}

export function createSymbolLayer(
  symbol: string,
  stageW: number,
  stageH: number,
  stackIndex = 0
): PrintDecoLayer {
  const trimmed = symbol.trim();
  if (!trimmed) {
    throw new Error("empty_symbol");
  }
  const box = defaultSymbolBox(stageW, stageH, stackIndex);
  const w = Math.max(1, stageW);
  const h = Math.max(1, stageH);
  return {
    id: newDecoId(),
    symbol: trimmed,
    rotation: 0,
    x: box.x / w,
    y: box.y / h,
    width: box.width / w,
    height: box.height / h,
  };
}

export function createDecoLayer(
  decoId: string,
  stageW: number,
  stageH: number,
  stackIndex = 0
): PrintDecoLayer {
  const item = DECO_CATALOG_BY_ID[decoId];
  if (!item) {
    throw new Error("unknown_deco");
  }
  const box = defaultDecoBox(item, stageW, stageH, stackIndex);
  const w = Math.max(1, stageW);
  const h = Math.max(1, stageH);
  return {
    id: newDecoId(),
    decoId: item.id,
    rotation: 0,
    x: box.x / w,
    y: box.y / h,
    width: box.width / w,
    height: box.height / h,
  };
}

export function resizeDecoPages(
  prev: PrintDecoLayer[][] | undefined,
  pageCount: number
): PrintDecoLayer[][] {
  const out: PrintDecoLayer[][] = [];
  for (let i = 0; i < pageCount; i++) {
    out.push(Array.isArray(prev?.[i]) ? prev[i] : []);
  }
  return out;
}

export function sanitizeDecoLayersByPage(
  raw: unknown
): PrintDecoLayer[][] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const pages: PrintDecoLayer[][] = [];
  for (const page of raw) {
    if (!Array.isArray(page)) {
      pages.push([]);
      continue;
    }
    const layers: PrintDecoLayer[] = [];
    for (const item of page) {
      if (!item || typeof item !== "object") continue;
      const obj = item as Record<string, unknown>;
      const decoId = typeof obj.decoId === "string" ? obj.decoId : "";
      const symbol = typeof obj.symbol === "string" ? obj.symbol.trim() : "";
      const hasDeco = Boolean(decoId && DECO_CATALOG_BY_ID[decoId]);
      const hasSymbol = symbol.length > 0;
      if (!hasDeco && !hasSymbol) continue;
      if (hasDeco && hasSymbol) continue;
      const x = Number(obj.x);
      const y = Number(obj.y);
      const width = Number(obj.width);
      const height = Number(obj.height);
      const rotation = Number(obj.rotation);
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
            : newDecoId(),
        ...(hasDeco ? { decoId } : { symbol }),
        ...(Number.isFinite(rotation) ? { rotation } : {}),
        x: Math.min(2.5, Math.max(-1.5, x)),
        y: Math.min(2.5, Math.max(-1.5, y)),
        width: Math.min(4, Math.max(0.02, width)),
        height: Math.min(4, Math.max(0.02, height)),
      });
    }
    pages.push(layers);
  }
  return pages;
}

export function catalogItemForLayer(layer: PrintDecoLayer): DecoCatalogItem | null {
  if (isSymbolLayer(layer) || !layer.decoId) return null;
  return DECO_CATALOG_BY_ID[layer.decoId] ?? null;
}
