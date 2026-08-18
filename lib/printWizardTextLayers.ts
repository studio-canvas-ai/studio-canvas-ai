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

export function clampOffset(v: number): number {
  return Math.max(-OFFSET_CLAMP, Math.min(OFFSET_CLAMP, v));
}

/** Uniform scale so text fits both portrait (A4) and landscape (16:9) canvases. */
export function canvasTextScale(stageW: number, stageH: number): number {
  const short = Math.max(1, Math.min(stageW, stageH));
  return short / PRINT_TEXT_REF_WIDTH;
}

export function clampBoxToStage(
  box: { x: number; y: number; width: number; height: number },
  stageW: number,
  stageH: number,
  margin = 4
): { x: number; y: number; width: number; height: number } {
  const maxW = Math.max(8, stageW - margin * 2);
  const maxH = Math.max(8, stageH - margin * 2);
  const width = Math.min(box.width, maxW);
  const height = Math.min(box.height, maxH);
  const x = Math.max(margin, Math.min(box.x, stageW - width - margin));
  const y = Math.max(margin, Math.min(box.y, stageH - height - margin));
  return { x, y, width, height };
}

let measureCanvas: HTMLCanvasElement | null = null;

function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!measureCanvas) measureCanvas = document.createElement("canvas");
  return measureCanvas.getContext("2d");
}

function layerPosY(layer: TextLayer, stageH: number): number {
  return layer.pos === "top"
    ? stageH * 0.08
    : layer.pos === "center"
      ? stageH * 0.42
      : stageH * 0.78;
}

function layerAnchorX(
  layer: TextLayer,
  stageW: number,
  boxW: number
): number {
  const margin = stageW * 0.08;
  const align = layer.align || "center";
  if (align === "left") return margin;
  if (align === "right") return stageW - margin - boxW;
  return (stageW - boxW) / 2;
}

/** Glyph-tight content size; wraps when the user has a stored box width. */
export function measureLayerContentSize(
  layer: TextLayer,
  stageW: number,
  stageH: number
): { width: number; height: number } {
  const scale = canvasTextScale(stageW, stageH);
  const fontSize = Math.max(8, Math.round((layer.fontSize || 48) * scale));
  const lineHeightMul = layer.lineHeight ?? 1.25;
  const letterSpacing = (layer.letterSpacing ?? 0) * scale;
  const rawText = (layer.text || "").length ? layer.text : "가";
  const fontFamily = fontForText(layer.fontPreset || "pretendard", rawText);
  const fontWeight = layer.fontWeight ?? 700;
  const ctx = getMeasureCtx();
  const padX = Math.max(4, fontSize * 0.08);
  const padY = Math.max(2, fontSize * 0.06);
  const boxWPx =
    layer.boxW && layer.boxW > 0 ? Math.max(12, layer.boxW * stageW) : 0;
  const wrapW = boxWPx > 0 ? Math.max(8, boxWPx - padX * 2) : Number.POSITIVE_INFINITY;

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
          Number.isFinite(wrapW) && wrapW > numColW + gap
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

  return {
    width: boxWPx > 0 ? boxWPx : Math.max(12, contentW + padX * 2),
    height:
      Math.max(fontSize * 1.05, fontSize * lineHeightMul * lineCount) + padY * 2,
  };
}

/** Compute pixel box from TextLayer — uses stored box size when the user resized. */
export function layerToBox(
  layer: TextLayer,
  stageW: number,
  stageH: number
): { x: number; y: number; width: number; height: number } {
  const measured = measureLayerContentSize(layer, stageW, stageH);
  const width =
    layer.boxW && layer.boxW > 0
      ? Math.max(12, layer.boxW * stageW)
      : measured.width;
  const storedH =
    layer.boxH && layer.boxH > 0 ? Math.max(12, layer.boxH * stageH) : 0;
  const height = Math.max(measured.height, storedH);

  if (
    layer.layoutLocked &&
    typeof layer.manualX === "number" &&
    typeof layer.manualY === "number"
  ) {
    return clampBoxToStage(
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

  const posY = layerPosY(layer, stageH);
  const x = layerAnchorX(layer, stageW, width) + (layer.offsetX || 0) * stageW;
  const y = posY + (layer.offsetY || 0) * stageH;
  return clampBoxToStage({ x, y, width, height }, stageW, stageH);
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
  "offsetX" | "offsetY" | "fontSize" | "boxW" | "boxH" | "layoutLocked" | "manualX" | "manualY"
> {
  const posY = layerPosY(layer, stageH);
  const offsetX = clampOffset(
    (box.x - layerAnchorX(layer, stageW, box.width)) / stageW
  );
  const offsetY = clampOffset((box.y - posY) / stageH);
  const boxW = box.width / Math.max(1, stageW);
  const boxH = box.height / Math.max(1, stageH);
  const manualX = box.x / Math.max(1, stageW);
  const manualY = box.y / Math.max(1, stageH);
  const lock = { layoutLocked: true as const, manualX, manualY };
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
/** Right-panel page buttons are always 1–8 in a 2×4 grid. */
export const EDITOR_PAGE_SLOTS = 8;

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
  const pos = slot < 2 ? "top" : slot < 4 ? "center" : "bottom";
  return createLayer({
    id: id ?? newLayerId(pageIndex, slot),
    text: "",
    color: "inkBlack",
    fontPreset: slot === 1 ? "poster" : "pretendard",
    fontSize: slot === 0 ? 28 : slot === 1 ? 48 : 24,
    fontWeight: slot === 1 ? 800 : 500,
    pos,
    offsetX: 0,
    offsetY: (slot - 2) * 0.1,
    maxWidth: 0.88,
    align: "center",
    letterSpacing: 0,
    lineHeight: 1.25,
  });
}

export function createDefaultPageLayers(pageIndex: number): TextLayer[] {
  return Array.from({ length: DEFAULT_PAGE_LAYER_COUNT }, (_, slot) => {
    const coverId =
      pageIndex === 0 && slot === 0
        ? "form-date"
        : pageIndex === 0 && slot === 1
          ? "form-title"
          : undefined;
    return createPlaceholderLayer(pageIndex, slot, coverId);
  });
}

export function padPageLayers(
  page: TextLayer[],
  pageIndex: number,
  minCount = DEFAULT_PAGE_LAYER_COUNT
): TextLayer[] {
  if (page.length >= minCount) return page;
  const next = [...page];
  while (next.length < minCount) {
    next.push(createPlaceholderLayer(pageIndex, next.length));
  }
  return next;
}

/** Keep each page's layer array independent; fill empty pages with 5 defaults. */
export function resizeIndependentPages(
  prev: TextLayer[][] | undefined,
  pageCount: number
): TextLayer[][] {
  const out: TextLayer[][] = [];
  for (let i = 0; i < pageCount; i++) {
    const page = prev?.[i];
    out.push(page && page.length > 0 ? page : createDefaultPageLayers(i));
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
