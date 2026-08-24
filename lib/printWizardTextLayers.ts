/**
 * Per-page text layer state for the print wizard preview.
 */

import { applyFieldLayoutToLayers, smartInputsToTextLayers } from "@/lib/ai/formToDesign";
import {
  formatFormFieldText,
  formFieldFromLayerId,
  parseProgramEntries,
  programNumberColumnWidth,
} from "@/lib/printWizardTextFormat";
import type { FieldLayoutKind, SmartInputValues, PrintPageCount } from "@/lib/printWizardTypes";
import { createLayer, fontForText, type TextLayer } from "@/lib/thumbnailStyles";
import {
  wrapMultiline,
  wrapParagraph,
} from "@/lib/printWizardTextDraw";

const OFFSET_CLAMP = 1.5;
export const PRINT_TEXT_REF_WIDTH = 1080;
/** Design size matching Template Studio (“완성하기”) body type. */
const PAGE_TEXT_SIZE = 105;

export function clampOffset(v: number): number {
  return Math.max(-OFFSET_CLAMP, Math.min(OFFSET_CLAMP, v));
}

/** Uniform scale so text fits both portrait (A4) and landscape (16:9) canvases. */
export function canvasTextScale(stageW: number, stageH: number): number {
  const short = Math.max(1, Math.min(stageW, stageH));
  return short / PRINT_TEXT_REF_WIDTH;
}

/** Keep glyphs inside the print safe area (green dotted line + ink overflow). */
export function printSafeInsetPx(stageW: number, stageH: number): number {
  const short = Math.max(1, Math.min(stageW, stageH));
  return Math.max(18, Math.round(short * 0.06));
}

export function clampBoxToStage(
  box: { x: number; y: number; width: number; height: number },
  stageW: number,
  stageH: number,
  margin = printSafeInsetPx(stageW, stageH)
): { x: number; y: number; width: number; height: number } {
  const maxW = Math.max(8, stageW - margin * 2);
  const maxH = Math.max(8, stageH - margin * 2);
  const width = Math.min(box.width, maxW);
  const height = Math.min(box.height, maxH);
  const x = Math.max(margin, Math.min(box.x, stageW - width - margin));
  const y = Math.max(margin, Math.min(box.y, stageH - height - margin));
  return { x, y, width, height };
}

/** Keep a sliver on-canvas so the box can hang off any edge without being lost. */
export const OVERFLOW_KEEP_PX = 28;

export function clampBoxAllowOverflow(
  box: { x: number; y: number; width: number; height: number },
  stageW: number,
  stageH: number,
  keep = OVERFLOW_KEEP_PX
): { x: number; y: number; width: number; height: number } {
  const maxEdge = Math.max(stageW, stageH, 1) * 3;
  const width = Math.min(Math.max(8, box.width), maxEdge);
  const height = Math.min(Math.max(8, box.height), maxEdge);
  const minKeep = Math.min(keep, width, height, stageW, stageH);
  const x = Math.max(minKeep - width, Math.min(box.x, stageW - minKeep));
  const y = Math.max(minKeep - height, Math.min(box.y, stageH - minKeep));
  return { x, y, width, height };
}

let measureCanvas: HTMLCanvasElement | null = null;

function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!measureCanvas) measureCanvas = document.createElement("canvas");
  return measureCanvas.getContext("2d");
}

function zonePad(stageW: number, stageH: number): number {
  return printSafeInsetPx(stageW, stageH);
}

/** Top-left Y so the box sits at top-center, true center, or bottom-center. */
function zoneBoxTop(
  pos: TextLayer["pos"] | undefined,
  stageW: number,
  stageH: number,
  boxH: number
): number {
  const pad = zonePad(stageW, stageH);
  const h = Math.max(1, boxH);
  if (pos === "top") return pad;
  if (pos === "center") return Math.max(pad, (stageH - h) / 2);
  return Math.max(pad, stageH - h - pad);
}

function layerAnchorX(
  layer: TextLayer,
  stageW: number,
  stageH: number,
  boxW: number
): number {
  const margin = printSafeInsetPx(stageW, stageH);
  const align = layer.align || "center";
  if (align === "left") return margin;
  if (align === "right") return stageW - margin - boxW;
  return (stageW - boxW) / 2;
}

/** Shift box origin when width changes so center/right alignment stays anchored. */
function adjustBoxXForWidthChange(
  layer: TextLayer,
  x: number,
  oldW: number,
  newW: number
): number {
  if (oldW === newW) return x;
  const delta = newW - oldW;
  const align = layer.align || "center";
  if (align === "center") return x - delta / 2;
  if (align === "right") return x - delta;
  return x;
}

/** Pixel box hugging current glyph metrics (typography slider two-way sync). */
function typographySyncedBox(
  layer: TextLayer,
  stageW: number,
  stageH: number
): { x: number; y: number; width: number; height: number } {
  const natural = measureLayerNaturalContentSize(layer, stageW, stageH);
  const storedWPx =
    layer.boxW && layer.boxW > 0 ? Math.max(8, layer.boxW * stageW) : 0;
  let x =
    typeof layer.manualX === "number" ? layer.manualX * stageW : 0;
  let y =
    typeof layer.manualY === "number" ? layer.manualY * stageH : 0;
  const width = natural.width;
  const height = natural.height;
  if (storedWPx > 0 && Math.abs(width - storedWPx) > 0.5) {
    x = adjustBoxXForWidthChange(layer, x, storedWPx, width);
  }
  if (
    layer.layoutLocked &&
    typeof layer.manualX === "number" &&
    typeof layer.manualY === "number"
  ) {
    return clampBoxAllowOverflow({ x, y, width, height }, stageW, stageH);
  }
  const posY = zoneBoxTop(layer.pos, stageW, stageH, height);
  x = layerAnchorX(layer, stageW, stageH, width) + (layer.offsetX || 0) * stageW;
  y = posY + (layer.offsetY || 0) * stageH;
  return clampBoxToStage({ x, y, width, height }, stageW, stageH);
}

export type MeasureLayerContentOptions = {
  /** Ignore stored boxW so glyph width drives size (typography slider expansion). */
  ignoreStoredBox?: boolean;
};

/** Glyph-tight content size; wraps when the user has a stored box width. */
export function measureLayerContentSize(
  layer: TextLayer,
  stageW: number,
  stageH: number,
  options?: MeasureLayerContentOptions
): { width: number; height: number } {
  const ignoreStoredBox = options?.ignoreStoredBox === true;
  const scale = canvasTextScale(stageW, stageH);
  const fontSize = Math.max(8, Math.round((layer.fontSize || 48) * scale));
  const lineHeightMul = layer.lineHeight ?? 1.25;
  const letterSpacing = (layer.letterSpacing ?? 0) * scale;
  const rawText = (layer.text || "").length ? layer.text : "가";
  const fontFamily = fontForText(layer.fontPreset || "pretendard", rawText);
  const fontWeight = layer.fontWeight ?? 700;
  const ctx = getMeasureCtx();
  const padX = Math.max(4, Math.round(fontSize * 0.16));
  const padY = Math.max(6, Math.round(fontSize * 0.22));
  const inset = printSafeInsetPx(stageW, stageH);
  const maxContentW = Math.max(
    8,
    Math.min(
      stageW - inset * 2,
      layer.maxWidth && layer.maxWidth > 0 ? layer.maxWidth * stageW : stageW
    )
  );
  const boxWPx =
    !ignoreStoredBox &&
    layer.layoutLocked &&
    layer.boxW &&
    layer.boxW > 0
      ? Math.max(12, Math.min(layer.boxW * stageW, maxContentW))
      : 0;
  const wrapW = ignoreStoredBox
    ? Number.POSITIVE_INFINITY
    : Math.max(8, (boxWPx > 0 ? boxWPx : maxContentW) - padX * 2);

  let contentW = 0;
  let lineCount = Math.max(1, rawText.split("\n").length);

  if (ctx) {
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    if (layer.id === "form-programs") {
      const entries = parseProgramEntries(rawText);
      if (entries.length) {
        const numColW = programNumberColumnWidth(
          entries,
          fontSize,
          fontWeight,
          ctx
        );
        const gap = fontSize * 0.35;
        const labelMax =
          ignoreStoredBox || !Number.isFinite(wrapW)
            ? Number.POSITIVE_INFINITY
            : wrapW > numColW + gap
              ? wrapW - numColW - gap
              : Number.POSITIVE_INFINITY;
        lineCount = 0;
        contentW = 0;
        for (const entry of entries) {
          ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
          const wrapped = Number.isFinite(labelMax)
            ? wrapParagraph(ctx, entry.label, labelMax, 0)
            : [entry.label];
          lineCount += Math.max(1, wrapped.length);
          const widest = Math.max(
            ...wrapped.map((w) => ctx.measureText(w).width)
          );
          contentW = Math.max(contentW, numColW + gap + widest);
        }
      }
    }
    if (!contentW) {
      if (Number.isFinite(wrapW)) {
        const wrapped = wrapMultiline(ctx, rawText, wrapW, letterSpacing);
        lineCount = wrapped.length;
        contentW = Math.max(
          ...wrapped.map((line) => {
            const sample = line.length ? line : " ";
            return (
              ctx.measureText(sample).width +
              Math.max(0, sample.length - 1) * letterSpacing
            );
          })
        );
      } else {
        const lines = rawText.split("\n");
        lineCount = Math.max(1, lines.length);
        for (const line of lines) {
          const sample = line.length ? line : " ";
          const extra = Math.max(0, sample.length - 1) * letterSpacing;
          contentW = Math.max(contentW, ctx.measureText(sample).width + extra);
        }
      }
    }
  } else {
    contentW = Math.max(
      1,
      ...rawText.split("\n").map((line) => Math.max(1, line.length) * fontSize * 0.92)
    );
  }

  const maxEdge = Math.max(stageW, stageH, 1) * 3;
  const naturalW = Math.min(maxEdge, Math.max(8, contentW + padX * 2));
  const autoW = Math.max(8, Math.min(maxContentW, contentW + padX * 2));

  return {
    width: boxWPx > 0 ? boxWPx : ignoreStoredBox ? naturalW : autoW,
    height:
      Math.max(fontSize, fontSize * lineHeightMul * lineCount) + padY * 2,
  };
}

/** Natural glyph-tight size ignoring stored resize width (for typography auto-expand). */
export function measureLayerNaturalContentSize(
  layer: TextLayer,
  stageW: number,
  stageH: number
): { width: number; height: number } {
  return measureLayerContentSize(layer, stageW, stageH, {
    ignoreStoredBox: true,
  });
}

/** Compute pixel box from TextLayer — uses stored box size when the user resized. */
export function layerToBox(
  layer: TextLayer,
  stageW: number,
  stageH: number
): { x: number; y: number; width: number; height: number } {
  const natural = measureLayerNaturalContentSize(layer, stageW, stageH);
  const measured = measureLayerContentSize(layer, stageW, stageH);
  const userSized =
    layer.layoutLocked && layer.boxManual && layer.boxW && layer.boxW > 0;

  let width: number;
  let height: number;
  if (userSized) {
    width = Math.max(8, layer.boxW! * stageW);
    const storedHPx =
      layer.boxH && layer.boxH > 0 ? Math.max(8, layer.boxH * stageH) : 0;
    height = storedHPx > 0 ? Math.max(natural.height, storedHPx) : natural.height;
  } else if (layer.layoutLocked) {
    width = natural.width;
    height = natural.height;
  } else {
    width = measured.width;
    height = measured.height;
  }

  if (
    layer.layoutLocked &&
    typeof layer.manualX === "number" &&
    typeof layer.manualY === "number"
  ) {
    return clampBoxAllowOverflow(
      {
        x: layer.manualX * stageW,
        y: layer.manualY * stageH,
        width,
        height,
      },
      stageW,
      stageH
    );
  }

  const posY = zoneBoxTop(layer.pos, stageW, stageH, height);
  const x = layerAnchorX(layer, stageW, stageH, width) + (layer.offsetX || 0) * stageW;
  const y = posY + (layer.offsetY || 0) * stageH;
  return clampBoxToStage({ x, y, width, height }, stageW, stageH);
}

/** Persist typography-synced boxW/boxH/manualX after slider changes (expand + shrink). */
export function reconcileLayerTypographyBox(
  layer: TextLayer,
  stageW: number,
  stageH: number
): TextLayer {
  if (!layer.layoutLocked) return layer;
  const box = typographySyncedBox(layer, stageW, stageH);
  const w = Math.max(1, stageW);
  const h = Math.max(1, stageH);
  const nextBoxW = box.width / w;
  const nextBoxH = box.height / h;
  const nextManualX = box.x / w;
  const nextManualY = box.y / h;
  if (
    layer.boxManual === false &&
    layer.boxW === nextBoxW &&
    layer.boxH === nextBoxH &&
    layer.manualX === nextManualX &&
    layer.manualY === nextManualY
  ) {
    return layer;
  }
  return {
    ...layer,
    boxManual: false,
    boxW: nextBoxW,
    boxH: nextBoxH,
    manualX: nextManualX,
    manualY: nextManualY,
  };
}

export function reconcileLayersTypographyBox(
  layers: TextLayer[],
  stageW: number,
  stageH: number
): TextLayer[] {
  let changed = false;
  const next = layers.map((layer) => {
    const reconciled = reconcileLayerTypographyBox(layer, stageW, stageH);
    if (reconciled !== layer) changed = true;
    return reconciled;
  });
  return changed ? next : layers;
}

/** Reference stage size for typography box sync (fractions are scale-invariant). */
export function referencePrintStageSize(aspect: number): {
  w: number;
  h: number;
} {
  const short = PRINT_TEXT_REF_WIDTH;
  const ratio = aspect > 0 ? aspect : 1;
  if (ratio >= 1) return { w: short * ratio, h: short };
  return { w: short, h: short / ratio };
}

export type BoxPatchMode = "move" | "resize";

/** Map dragged/resized pixel box back to TextLayer offsets. */
export function boxToLayerPatch(
  layer: TextLayer,
  box: { x: number; y: number; width: number; height: number },
  stageW: number,
  stageH: number,
  _mode: BoxPatchMode = "move",
  _startBox?: { width: number; height: number }
): Pick<
  TextLayer,
  | "offsetX"
  | "offsetY"
  | "fontSize"
  | "boxW"
  | "boxH"
  | "layoutLocked"
  | "manualX"
  | "manualY"
  | "boxManual"
> {
  const posY = zoneBoxTop(layer.pos, stageW, stageH, box.height);
  const offsetX = clampOffset(
    (box.x - layerAnchorX(layer, stageW, stageH, box.width)) / stageW
  );
  const offsetY = clampOffset((box.y - posY) / stageH);
  const boxW = box.width / Math.max(1, stageW);
  const boxH = box.height / Math.max(1, stageH);
  const manualX = box.x / Math.max(1, stageW);
  const manualY = box.y / Math.max(1, stageH);
  const lock = { layoutLocked: true as const, manualX, manualY, boxManual: true as const };
  return { offsetX, offsetY, fontSize: layer.fontSize, boxW, boxH, ...lock };
}

function fieldFromLayerId(id: string): keyof SmartInputValues | null {
  const field = formFieldFromLayerId(id);
  return field as keyof SmartInputValues | null;
}

function sanitizePrintFormLayer(layer: TextLayer): TextLayer {
  const field = formFieldFromLayerId(layer.id);
  if (!field) return layer;
  const text = formatFormFieldText(field, layer.text);
  const base: TextLayer = {
    ...layer,
    text,
    showBox: false,
    showBoxBorder: false,
    ranges: [],
  };
  if (layer.layoutLocked) return base;
  return {
    ...base,
    letterSpacing:
      field === "date" || field === "programs"
        ? 0
        : layer.letterSpacing ?? 0,
    lineHeight:
      field === "programs"
        ? Math.max(layer.lineHeight ?? 1.4, 1.4)
        : layer.lineHeight,
    align: field === "programs" ? "left" : layer.align ?? "center",
  };
}

export function layersToInputPatch(
  layers: TextLayer[]
): Partial<SmartInputValues> {
  const patch: Partial<SmartInputValues> = {};
  for (const layer of layers) {
    const field = fieldFromLayerId(layer.id);
    if (field) patch[field] = layer.text;
  }
  return patch;
}

/** Merge live form input text into existing layers (preserve geometry). */
export function mergeInputTextIntoLayers(
  layers: TextLayer[],
  inputs: SmartInputValues
): TextLayer[] {
  const byId = new Map(layers.map((l) => [l.id, l]));
  const fresh = smartInputsToTextLayers(inputs);
  const out: TextLayer[] = [];

  for (const next of fresh) {
    const prev = byId.get(next.id);
    if (prev) {
      const field = formFieldFromLayerId(next.id);
      const text = field
        ? formatFormFieldText(field, next.text)
        : next.text;
      out.push(
        sanitizePrintFormLayer({
          ...prev,
          text,
          color: next.color,
        })
      );
      byId.delete(next.id);
    } else {
      out.push(sanitizePrintFormLayer(next));
    }
  }

  for (const layer of layers) {
    if (byId.has(layer.id)) out.push(layer);
  }

  return out;
}
export function cloneLayers(layers: TextLayer[]): TextLayer[] {
  return layers.map((l) => ({ ...l }));
}

export function applyFieldLayoutToPages(
  pages: TextLayer[][],
  layout?: FieldLayoutKind | null
): TextLayer[][] {
  return pages.map((page) => applyFieldLayoutToLayers(page, layout));
}

/** Ensure one TextLayer[] per page; never clone page 1 onto other faces. */
export function ensureTextLayersByPage(
  prev: TextLayer[][] | undefined,
  pageCount: PrintPageCount,
  inputs: SmartInputValues
): TextLayer[][] {
  const out: TextLayer[][] = [];
  for (let i = 0; i < pageCount; i++) {
    if (prev?.[i]?.length) {
      out.push(mergeInputTextIntoLayers(prev[i], inputs));
    } else {
      out.push([]);
    }
  }
  return out;
}

export function duplicateTextLayer(
  layers: TextLayer[],
  layerId: string
): TextLayer[] {
  const source = layers.find((l) => l.id === layerId);
  if (!source) return layers;
  const copy = createLayer({
    ...source,
    id: `layer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    offsetX: clampOffset((source.offsetX || 0) + 0.04),
    offsetY: clampOffset((source.offsetY || 0) + 0.04),
  });
  return [...layers, copy];
}

const PLACEHOLDER_PREFIX_RE = /^\s*(상단문구:|중간문구:|하단문구:)\s*/;

export function stripLayerPlaceholderPrefix(text: string): string {
  return text.replace(PLACEHOLDER_PREFIX_RE, "");
}

export function removeTextLayer(
  layers: TextLayer[],
  layerId: string
): TextLayer[] {
  return layers.filter((layer) => layer.id !== layerId);
}

/** Clear form fields whose canvas layers were deleted so they are not auto-restored. */
export function formFieldsClearedByRemovedLayers(
  prevLayers: TextLayer[],
  nextLayers: TextLayer[]
): Partial<SmartInputValues> {
  const nextIds = new Set(nextLayers.map((layer) => layer.id));
  const patch: Partial<SmartInputValues> = {};
  for (const layer of prevLayers) {
    if (nextIds.has(layer.id)) continue;
    const field = fieldFromLayerId(layer.id);
    if (field) patch[field] = "";
  }
  return patch;
}

export const DEFAULT_PAGE_LAYER_COUNT = 5;
export const COVER_ZONE_LAYER_COUNT = 3;
/** Right-panel page buttons are always 1–8 in a 2×4 grid. */
export const EDITOR_PAGE_SLOTS = 8;
const DEFAULT_SLOT_POSITIONS = ["top", "center", "bottom"] as const;
export const PAGE_ZONE_ORDER = ["top", "center", "bottom"] as const;
export type SemanticZone = (typeof PAGE_ZONE_ORDER)[number];
export const PAGE_ZONE_LABELS: Record<SemanticZone, string> = {
  top: "상단문구",
  center: "중간문구",
  bottom: "하단문구",
};

export function editorSlotCount(pageCount: number): number {
  return Math.max(pageCount, EDITOR_PAGE_SLOTS);
}

function newLayerId(pageIndex: number, slot: number): string {
  return `page-${pageIndex}-slot-${slot}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createPlaceholderLayer(
  pageIndex: number,
  slot: number,
  id?: string
): TextLayer {
  const pos = DEFAULT_SLOT_POSITIONS[slot] ?? "bottom";
  return createLayer({
    id: id ?? newLayerId(pageIndex, slot),
    text: "",
    color: "inkBlack",
    fontPreset: "pretendard",
    fontSize: PAGE_TEXT_SIZE,
    fontWeight: 700,
    pos,
    offsetX: 0,
    offsetY: 0,
    maxWidth: 0.88,
    align: "center",
    letterSpacing: 0,
    lineHeight: 1.25,
  });
}

const SEMANTIC_ZONE_STYLES: Record<
  SemanticZone,
  Pick<TextLayer, "pos" | "offsetY" | "fontPreset" | "fontSize" | "fontWeight" | "align">
> = {
  top: {
    pos: "top",
    offsetY: 0,
    fontPreset: "pretendard",
    fontSize: PAGE_TEXT_SIZE,
    fontWeight: 700,
    align: "center",
  },
  center: {
    pos: "center",
    offsetY: 0,
    fontPreset: "pretendard",
    fontSize: PAGE_TEXT_SIZE,
    fontWeight: 700,
    align: "center",
  },
  bottom: {
    pos: "bottom",
    offsetY: 0,
    fontPreset: "pretendard",
    fontSize: PAGE_TEXT_SIZE,
    fontWeight: 700,
    align: "center",
  },
};

export function layerZone(layer: TextLayer): SemanticZone {
  if (layer.pos === "top" || layer.pos === "center" || layer.pos === "bottom") {
    return layer.pos;
  }
  return "bottom";
}

function makeZoneLayer(pageIndex: number, zone: SemanticZone): TextLayer {
  return createLayer({
    ...SEMANTIC_ZONE_STYLES[zone],
    id: `page-${pageIndex}-zone-${zone}-${Math.random().toString(36).slice(2, 7)}`,
    text: "",
    color: "inkBlack",
    maxWidth: 0.88,
    lineHeight: 1.25,
    letterSpacing: 0,
  });
}

/** Drop leftover empty default extras so each cover zone starts with one row. */
function pruneEmptyDefaultZoneExtras(layers: TextLayer[]): TextLayer[] {
  const kept: TextLayer[] = [];
  for (const zone of PAGE_ZONE_ORDER) {
    const zoneLayers = layers.filter((layer) => layerZone(layer) === zone);
    zoneLayers.forEach((layer, index) => {
      const keep =
        index === 0 ||
        layer.text.trim().length > 0 ||
        /-layer-/.test(layer.id);
      if (keep) kept.push(layer);
    });
  }
  return kept;
}

/** Keep one empty row in each zone so 상단/중간/하단 labels never vanish. */
export function ensurePageZoneLayers(
  layers: TextLayer[],
  pageIndex: number
): TextLayer[] {
  if (pageIndex !== 0) return layers;
  const cleaned = layers.map((layer) => ({
    ...layer,
    text: stripLayerPlaceholderPrefix(layer.text),
  }));
  const pruned = pruneEmptyDefaultZoneExtras(cleaned);
  const result: TextLayer[] = [];
  for (const zone of PAGE_ZONE_ORDER) {
    const zoneLayers = pruned.filter((layer) => layerZone(layer) === zone);
    if (zoneLayers.length) result.push(...zoneLayers);
    else result.push(makeZoneLayer(pageIndex, zone));
  }
  return result;
}

const ZONE_STACK_GAP = 0.075;

function applyReadableType(layer: TextLayer): TextLayer {
  if (layer.layoutLocked) return layer;
  // Never snap user-chosen font sizes back to PAGE_TEXT_SIZE.
  const fontSize =
    typeof layer.fontSize === "number" && layer.fontSize >= 10
      ? layer.fontSize
      : PAGE_TEXT_SIZE;
  return {
    ...layer,
    fontSize,
    fontWeight:
      layer.fontWeight && layer.fontWeight >= 600 ? layer.fontWeight : 700,
    align: layer.align || "center",
  };
}

/** Stack extra layers below the zone anchor. First layer stays at the zone center. */
export function stackLayersInZones(layers: TextLayer[]): TextLayer[] {
  const next = layers.slice();
  const unlockedByZone: Record<SemanticZone, number[]> = {
    top: [],
    center: [],
    bottom: [],
  };
  next.forEach((layer, index) => {
    if (layer.layoutLocked) return;
    unlockedByZone[layerZone(layer)].push(index);
  });

  (["top", "center", "bottom"] as const).forEach((zone) => {
    unlockedByZone[zone].forEach((layerIndex, order) => {
      next[layerIndex] = applyReadableType({
        ...next[layerIndex],
        pos: zone,
        offsetX: 0,
        offsetY: order * ZONE_STACK_GAP,
        align: "center",
      });
    });
  });

  return next;
}

/** Later pages: layer 1 at the top, then 2, 3... straight down. */
export function stackLayersFromTop(layers: TextLayer[]): TextLayer[] {
  return layers.map((layer, order) => {
    if (layer.layoutLocked) return layer;
    return applyReadableType({
      ...layer,
      pos: "top",
      offsetX: 0,
      offsetY: order * ZONE_STACK_GAP,
      align: "center",
    });
  });
}

export function applySemanticPageLayout(
  layers: TextLayer[],
  pageIndex: number
): TextLayer[] {
  if (pageIndex === 0) {
    return stackLayersInZones(ensurePageZoneLayers(layers, pageIndex));
  }
  const cleaned = layers.map((layer) => ({
    ...layer,
    text: stripLayerPlaceholderPrefix(layer.text),
  }));
  return stackLayersFromTop(
    cleaned.length ? cleaned : createDefaultPageLayers(pageIndex)
  );
}

export function createDefaultPageLayers(pageIndex: number): TextLayer[] {
  if (pageIndex === 0) {
    return PAGE_ZONE_ORDER.map((_, slot) => {
      const coverId =
        slot === 0 ? "form-date" : slot === 1 ? "form-title" : undefined;
      return createPlaceholderLayer(pageIndex, slot, coverId);
    });
  }
  return Array.from({ length: DEFAULT_PAGE_LAYER_COUNT }, (_, slot) =>
    createLayer({
      ...SEMANTIC_ZONE_STYLES.top,
      id: newLayerId(pageIndex, slot),
      text: "",
      color: "inkBlack",
      maxWidth: 0.88,
      lineHeight: 1.25,
      letterSpacing: 0,
      offsetY: slot * ZONE_STACK_GAP,
    })
  );
}

export function padPageLayers(
  page: TextLayer[],
  pageIndex: number,
  minCount = DEFAULT_PAGE_LAYER_COUNT
): TextLayer[] {
  const floor = pageIndex === 0 ? COVER_ZONE_LAYER_COUNT : minCount;
  if (page.length >= floor) return page;
  const next = [...page];
  while (next.length < floor) {
    next.push(createPlaceholderLayer(pageIndex, next.length));
  }
  return next;
}

/** Keep each page's layer array independent; fill empty pages with zone defaults. */
export function resizeIndependentPages(
  prev: TextLayer[][] | undefined,
  pageCount: number
): TextLayer[][] {
  const out: TextLayer[][] = [];
  for (let i = 0; i < pageCount; i++) {
    const page = prev?.[i];
    const source = page && page.length > 0 ? page : createDefaultPageLayers(i);
    out.push(
      source.map((layer) => {
        const nextSize =
          layer.fontSize === 40 ? { ...layer, fontSize: PAGE_TEXT_SIZE } : layer;
        return nextSize.color === "white"
          ? { ...nextSize, color: "inkBlack" }
          : nextSize;
      })
    );
  }
  return out;
}

/** Date / title stay document-level and only update matching layers on each page. */
export function syncGlobalFieldsIntoPages(
  pages: TextLayer[][],
  inputs: SmartInputValues
): TextLayer[][] {
  return pages.map((page) =>
    page.map((layer) => {
      const field = fieldFromLayerId(layer.id);
      if (!field || (field !== "date" && field !== "title")) return layer;
      const text = formatFormFieldText(field, inputs[field]);
      return text === layer.text ? layer : { ...layer, text };
    })
  );
}

export function addPageTextLayer(
  layers: TextLayer[],
  pageIndex: number
): TextLayer[] {
  return [...layers, createPlaceholderLayer(pageIndex, layers.length)];
}

export function addPageTextLayerAfter(
  layers: TextLayer[],
  pageIndex: number,
  afterIndex: number
): TextLayer[] {
  if (layers.length === 0) {
    return [createPlaceholderLayer(pageIndex, 0)];
  }
  const sourceIndex = Math.max(
    0,
    Math.min(layers.length - 1, Math.trunc(afterIndex))
  );
  const insertAt = sourceIndex + 1;
  const source = layers[sourceIndex];
  const zone: SemanticZone =
    pageIndex === 0
      ? source?.pos === "top" ||
        source?.pos === "center" ||
        source?.pos === "bottom"
        ? source.pos
        : "top"
      : "top";
  const nextLayer = createLayer({
    ...source,
    ...SEMANTIC_ZONE_STYLES[zone],
    id: `page-${pageIndex}-layer-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    text: source?.text ?? "",
    color: source?.color ?? "inkBlack",
    fontPreset: source?.fontPreset ?? "pretendard",
    fontSize: source?.fontSize ?? PAGE_TEXT_SIZE,
    fontWeight: source?.fontWeight ?? 700,
    maxWidth: source?.maxWidth ?? 0.88,
    lineHeight: source?.lineHeight ?? 1.25,
    letterSpacing: source?.letterSpacing ?? 0,
    align: source?.align ?? "center",
    ranges: (source?.ranges ?? []).map((range) => ({ ...range })),
    stickerId: source?.stickerId ?? null,
    layoutLocked: false,
    manualX: undefined,
    manualY: undefined,
    boxW: undefined,
    boxH: undefined,
  });
  const next = layers.slice();
  next.splice(insertAt, 0, nextLayer);
  return next;
}

export function patchGlobalInputsFromPage(
  layers: TextLayer[],
  inputs: SmartInputValues
): SmartInputValues {
  const next = { ...inputs };
  for (const layer of layers) {
    const field = fieldFromLayerId(layer.id);
    if (field === "date" || field === "title") next[field] = layer.text;
  }
  return next;
}

export function sanitizeTextLayersByPage(raw: unknown): TextLayer[][] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const pages: TextLayer[][] = [];
  for (const page of raw) {
    if (!Array.isArray(page)) continue;
    const layers: TextLayer[] = [];
    for (const item of page) {
      if (!item || typeof item !== "object") continue;
      const obj = item as Partial<TextLayer>;
      if (typeof obj.id !== "string" || typeof obj.text !== "string") continue;
      layers.push(
        sanitizePrintFormLayer(
          createLayer({
            ...obj,
            id: obj.id,
            text: obj.text,
          })
        )
      );
    }
    pages.push(layers);
  }
  return pages.length ? pages : undefined;
}

/**
 * Same layers PreviewCanvas paints — fill from smart inputs when page text is empty
 * so export never drops visible title/date fallbacks.
 */
export function resolvePageTextLayersForExport(
  pages: TextLayer[][] | undefined,
  pageIndex: number,
  inputs: SmartInputValues,
  pageCount: number
): TextLayer[] {
  const resized = resizeIndependentPages(
    pages,
    Math.max(1, pageCount || 1)
  );
  const page = resized[Math.max(0, pageIndex)] ?? [];
  if (page.some((l) => Boolean(l.text?.trim()))) {
    return page.map((l) => ({
      ...l,
      fontSize: Math.max(10, Math.round(l.fontSize || PAGE_TEXT_SIZE)),
    }));
  }
  const merged = mergeInputTextIntoLayers(
    page.length ? page : createDefaultPageLayers(pageIndex),
    inputs
  );
  if (merged.some((l) => Boolean(l.text?.trim()))) return merged;
  // Last resort: build fresh form layers from inputs.
  const fresh = smartInputsToTextLayers(inputs).filter((l) =>
    Boolean(l.text?.trim())
  );
  return fresh.length ? fresh : merged;
}

/** Clamp user font size for Step-1 typography controls. */
export const PRINT_USER_FONT_SIZE_MIN = 10;
export const PRINT_USER_FONT_SIZE_MAX = 360;

export function clampUserFontSize(n: number): number {
  if (!Number.isFinite(n)) return PAGE_TEXT_SIZE;
  return Math.min(
    PRINT_USER_FONT_SIZE_MAX,
    Math.max(PRINT_USER_FONT_SIZE_MIN, Math.round(n))
  );
}
