/**
 * Screen-26 Magic Layout Engine — Gemini JSON → TextLayer + PrintDecoLayer.
 * Coordinates: pixels (canvas W×H) or normalized 0–1 (auto-detected).
 *
 * Element types: text | rect | circle | line | icon | shape | box (legacy rect).
 * Screen-26 uses HTML overlays; pure plates = TextLayer showBox (ZWSP, no copy);
 * text = independent TextLayer atoms; icons → Lucide SVG deco; shapes → vector deco.
 * NEVER merge text into plates. NEVER map icons to smartphone emoji.
 */

import { createLayer, type TextLayer } from "@/lib/thumbnailStyles";
import {
  createLucideDecoLayer,
  createShapeDecoLayer,
  parseDecoShapeType,
} from "@/lib/printWizardDecoLayers";
import { isEmojiGlyph, normalizeLucideIconName } from "@/lib/printWizardLucide";
import type { PrintDecoLayer } from "@/lib/printWizardTypes";
import {
  inferBackgroundTone,
  parseFillColor,
  resolveContrastTextAppearance,
} from "@/lib/ai/textContrastSafety";
import { expandInfoGridSeeds } from "@/lib/ai/layoutInfoGrid";

export type PrintLayoutElementText = {
  id?: string;
  type: "text";
  text: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  fontSize?: number;
  fill?: string;
  fontFamily?: string;
  fontWeight?: string | number;
  align?: "left" | "center" | "right";
  backgroundFill?: string;
  backgroundOpacity?: number;
  cornerRadius?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  stroke?: string;
  strokeWidth?: number;
};

export type PrintLayoutElementRect = {
  id?: string;
  type: "rect" | "box";
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
};

export type PrintLayoutElementCircle = {
  id?: string;
  type: "circle";
  x: number;
  y: number;
  /** Circle center OR top-left — we treat x,y as top-left of bounding box when radius given. */
  radius?: number;
  width?: number;
  height?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
};

export type PrintLayoutElementLine = {
  id?: string;
  type: "line";
  x: number;
  y: number;
  width?: number;
  height?: number;
  /** Alternate endpoint form */
  x2?: number;
  y2?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
};

export type PrintLayoutElementIcon = {
  id?: string;
  type: "icon";
  /** Lucide kebab-case name (any icon from the full library). */
  iconName: string;
  x: number;
  y: number;
  size?: number;
  width?: number;
  height?: number;
  fill?: string;
  color?: string;
};

export type PrintLayoutElementShape = {
  id?: string;
  type: "shape";
  shapeType: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
};

export type PrintLayoutElement =
  | PrintLayoutElementText
  | PrintLayoutElementRect
  | PrintLayoutElementCircle
  | PrintLayoutElementLine
  | PrintLayoutElementIcon
  | PrintLayoutElementShape;

export type PrintLayoutPlan = {
  bg_prompt: string;
  elements: PrintLayoutElement[];
};

export type GenerateLayoutRequest = {
  formatLabel: string;
  styleLabel: string;
  useLabel: string;
  backgroundFieldLabel: string;
  categoryLabel?: string;
  prompt: string;
  canvasWidth: number;
  canvasHeight: number;
  pageIndex?: number;
  pageCount?: number;
};

export type MappedLayoutLayers = {
  textLayers: TextLayer[];
  decoLayers: PrintDecoLayer[];
};

export const PRINT_LAYOUT_SYSTEM_INSTRUCTION = `You are an elite Canva Magic Studio–level graphic designer and Korean copywriter for print (flyer, poster, menu, event, coupon, brochure).

Return ONE JSON object only (no markdown fences, no commentary):
{
  "bg_prompt": "English Flux.1 prompt: cinematic print background, professional lighting, explicit NEGATIVE SPACE (empty zones for typography — e.g. open upper third or left column). NEVER include letters, logos, watermarks, or readable text in the image.",
  "elements": [ /* dynamic list — see rules */ ]
}

Element types (use freely, mix as needed):
- "text": { id, type, text, x, y, width, height?, fontSize, fontWeight, fill, align, fontFamily?, backgroundFill?, backgroundOpacity?, cornerRadius?, shadowColor?, shadowBlur?, shadowOffsetX?, shadowOffsetY?, stroke?, strokeWidth? }
- "rect": { id, type, x, y, width, height, fill, stroke?, strokeWidth?, cornerRadius? }
- "circle": { id, type, x, y, radius, fill, stroke?, strokeWidth? }  // x,y = CENTER of circle
- "line": { id, type, x, y, width, height?, stroke?, strokeWidth?, fill? }  // thin bar (prefer horizontal)
- "icon": { id, type, iconName, x, y, size, color? }  // Lucide kebab-case ONLY — NEVER emoji
- "shape": { id, type, shapeType, x, y, width, height, fill?, stroke?, strokeWidth?, cornerRadius? }
  // shapeType: rect | circle | pill | frame | line | ribbon | stamp (aliases: badge_ribbon, border_frame, divider_line, accent_pill, stamp_circle)

ICON RULES (critical):
1. iconName = any Lucide Icons name from the full 1000+ library, chosen for THIS theme only.
2. NEVER use smartphone emoji (📅📍🎁🏆✨🎉…). NEVER default to calendar + map-pin + gift + trophy on every design.
3. Max 0–4 unique icons. Prefer decorative shapes (ribbon/frame/pill/stamp/line) for visual richness.
4. Theme cues (examples only): autumn→leaf/tree-pine/mountain/wind; festival→music/ticket/mic/drama; heritage→landmark/scroll/feather/crown; retail→shopping-bag/utensils/tag.

COORDINATE SYSTEM (critical — wrong coords cause rightward drift):
1. All x,y,width,height,fontSize,radius,size MUST be PIXELS for the exact canvasWidth×canvasHeight from the user message. Never invent another resolution (no 1920×1080 when canvas is 1080×1920). Never use 0–1 normalized fractions.
2. Origin is TOP-LEFT. For every element except circle, (x,y) is the TOP-LEFT of the bounding box — NEVER the visual center.
3. Every element must stay inside the canvas: 0 ≤ x, x+width ≤ canvasWidth, 0 ≤ y, y+height ≤ canvasHeight (4% safe margin preferred).
4. Horizontally centered elements: set width first, then x = (canvasWidth - width) / 2. Do NOT put the center x into the x field.
5. Full-bleed / main titles (hero headline near the top): ALWAYS use x = 0, width = canvasWidth, align = "center".
6. ATOMIC SEPARATION (absolute): Every rect/circle/shape is a PURE backdrop with NO embedded text/label. Every title, subtitle, and body line is its OWN independent "text" element. Never put copy inside a rect object. Never rely on backgroundFill to glue title+panel into one node — emit a rect AND a separate text.
7. INFO / GUIDE LISTS (일시·장소·입장…): NEVER pack into one multiline text blob. Emit a 2-COLUMN GRID of separate text nodes:
   - Left column labels ("일시","장소","입장",…) share the SAME x, align "left" (or all "right"), fixed width ~90–140px.
   - Right column values share a SECOND fixed x (labelX + labelWidth + 16–24), align "left".
   - Row y = firstRowY + rowIndex * 32 (exact 32px step). One label text + one value text per row.
8. Circle: x,y are CENTER; radius in pixels. Label text for a circle badge is a SEPARATE text node (not inside the circle object).

CONTRAST / READABILITY (absolute — never bury type in the photo):
1. BOX-LOCAL FIRST: For every text that sits on a rect/shape/circle, compute that box fill luminance and set text.fill accordingly:
   - Dark boxes (deep green, black, navy, charcoal, rgba dark panels): text.fill MUST be light — #FFFFFF, soft ivory #F8F1E3, or pastel yellow #F7E7A1. NEVER dark ink/charcoal on dark boxes.
   - Light boxes (white, cream, pastel panels): text.fill MUST be dark — #1A1A1A, #2C1810, or #1B365D. NEVER solo white on light boxes.
2. Scene-level (text on photo with no plate): LIGHT scenes → dark type; DARK scenes → white/gold type.
3. If you intentionally use light type on a light/complex photo:
   a. Include shadowColor:"rgba(0,0,0,0.7)", shadowBlur:10, shadowOffsetY:2 on the text, AND/OR
   b. Place a translucent backdrop rect under the text.
4. Contrast ratio target ≥ 4.5 between text fill and its immediate box. Optional stroke/strokeWidth (1–2px) allowed.
5. Text fill is an independent editable property — choose a readable default; users may recolor later in the editor.

DYNAMIC LAYOUT:
1. Do NOT hardcode counts. Infer structure from 용도 + 분야 + prompt.
2. ATOMIZE: every editable string is its own text node (title, "축제안내", each info label, each info value, captions). Users must move/delete each text alone.
3. Prefer 12–28 elements (min 6). List pure plates/shapes before overlapping text in the array.
4. Korean copy finished and purpose-fit. High-contrast colors; rgba plates OK.
5. bg_prompt English only with negative space matching text clusters.
6. STRICT JSON only.`

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** Accept normalized 0–1 or pixel values (when canvas size known). */
export function toNormalized(
  value: number,
  axisSize: number,
  treatAsPixelIfGt1 = true
): number {
  if (!Number.isFinite(value)) return 0;
  if (treatAsPixelIfGt1 && Math.abs(value) > 1 && axisSize > 0) {
    return clamp01(value / axisSize);
  }
  return clamp01(value);
}

/** Detect whether a layout payload is in pixel space vs 0–1 fractions. */
export function layoutPlanUsesPixels(
  elements: PrintLayoutElement[],
  stageW: number,
  stageH: number
): boolean {
  let maxAbs = 0;
  for (const el of elements) {
    maxAbs = Math.max(maxAbs, Math.abs(el.x), Math.abs(el.y));
    if ("width" in el && typeof el.width === "number") {
      maxAbs = Math.max(maxAbs, Math.abs(el.width));
    }
    if ("height" in el && typeof el.height === "number") {
      maxAbs = Math.max(maxAbs, Math.abs(el.height));
    }
    if (el.type === "circle" && typeof el.radius === "number") {
      maxAbs = Math.max(maxAbs, Math.abs(el.radius));
    }
    if (el.type === "text" && typeof el.fontSize === "number") {
      maxAbs = Math.max(maxAbs, Math.abs(el.fontSize));
    }
    if (el.type === "icon" && typeof el.size === "number") {
      maxAbs = Math.max(maxAbs, Math.abs(el.size));
    }
  }
  // Values clearly beyond unit interval → pixels. Also treat near-stage sizes as pixels.
  if (maxAbs > 1.5) return true;
  if (maxAbs > 1 && (stageW > 2 || stageH > 2)) return true;
  return false;
}

export function toStagePixels(
  value: number,
  axisSize: number,
  usePixels: boolean
): number {
  if (!Number.isFinite(value)) return 0;
  if (usePixels) return value;
  return value * axisSize;
}

type PixelRect = {
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
  stroke?: string;
  cornerRadius?: number;
  circle?: boolean;
  id?: string;
  sourceIndex: number;
};

type PixelText = {
  el: PrintLayoutElementText;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
  sourceIndex: number;
};

function clampBoxPx(
  x: number,
  y: number,
  w: number,
  h: number,
  stageW: number,
  stageH: number
): { x: number; y: number; w: number; h: number } {
  const width = Math.max(8, Math.min(w, stageW));
  const height = Math.max(8, Math.min(h, stageH));
  return {
    x: Math.max(0, Math.min(x, stageW - width)),
    y: Math.max(0, Math.min(y, stageH - height)),
    w: width,
    h: height,
  };
}

/** If Gemini put center-x into x for a center-aligned box, convert to top-left. */
function coerceTopLeftFromPossibleCenter(
  x: number,
  w: number,
  stageW: number,
  align: PrintLayoutElementText["align"]
): number {
  if (align !== "center" && align !== undefined) return x;
  const asLeft = x;
  const asCenter = x - w / 2;
  const leftFits =
    asLeft >= -stageW * 0.02 && asLeft + w <= stageW * 1.02;
  const centerFits =
    asCenter >= -stageW * 0.02 && asCenter + w <= stageW * 1.02;
  // Classic drift: x near mid while width is large → x was center.
  const looksLikeCenterPoint =
    Math.abs(x - stageW / 2) < stageW * 0.12 &&
    w > stageW * 0.25 &&
    asLeft + w > stageW * 1.02;
  if (looksLikeCenterPoint && centerFits) return asCenter;
  // Overflow on the right when treating as left → prefer center interpretation.
  if (!leftFits && centerFits) return asCenter;
  return asLeft;
}

/**
 * Standalone / title text: full-bleed center or snap x = (W - w) / 2.
 */
export function normalizeStandaloneTextBox(
  x: number,
  y: number,
  w: number,
  h: number,
  fontSize: number,
  align: PrintLayoutElementText["align"],
  stageW: number,
  stageH: number,
  text: string
): { x: number; y: number; w: number; h: number; align: "left" | "center" | "right" } {
  const short = Math.min(stageW, stageH);
  let nx = coerceTopLeftFromPossibleCenter(x, w, stageW, align ?? "center");
  let nw = Math.max(8, w);
  let ny = y;
  let nh = Math.max(8, h);
  let nextAlign: "left" | "center" | "right" = align ?? "center";

  const isHeroTitle =
    nextAlign !== "left" &&
    nextAlign !== "right" &&
    (nw >= stageW * 0.65 ||
      fontSize >= short * 0.048 ||
      (ny < stageH * 0.28 && fontSize >= short * 0.036) ||
      (text.length <= 24 && nw >= stageW * 0.5 && ny < stageH * 0.35));

  if (isHeroTitle) {
    nx = 0;
    nw = stageW;
    nextAlign = "center";
  } else if (nextAlign === "center") {
    const centerX = nx + nw / 2;
    // Intended page-centered block → force mathematical center.
    if (Math.abs(centerX - stageW / 2) < stageW * 0.18 || nw >= stageW * 0.45) {
      nx = (stageW - nw) / 2;
    }
  }

  const clamped = clampBoxPx(nx, ny, nw, nh, stageW, stageH);
  return { ...clamped, align: nextAlign };
}

function rectContainsPoint(
  rect: { x: number; y: number; w: number; h: number },
  px: number,
  py: number,
  pad = 0
): boolean {
  return (
    px >= rect.x - pad &&
    px <= rect.x + rect.w + pad &&
    py >= rect.y - pad &&
    py <= rect.y + rect.h + pad
  );
}

function parseRgba(fill: string | undefined): {
  hex: string;
  opacity: number;
} {
  const raw = (fill || "").trim();
  if (!raw) return { hex: "#000000", opacity: 0.55 };
  const rgba = raw.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i
  );
  if (rgba) {
    const r = Math.round(Number(rgba[1]));
    const g = Math.round(Number(rgba[2]));
    const b = Math.round(Number(rgba[3]));
    const a = rgba[4] != null ? Number(rgba[4]) : 1;
    const hex = `#${[r, g, b]
      .map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0"))
      .join("")}`;
    return { hex, opacity: Number.isFinite(a) ? Math.max(0, Math.min(1, a)) : 1 };
  }
  if (/^#[0-9A-Fa-f]{3,8}$/.test(raw)) {
    return {
      hex:
        raw.length === 4
          ? `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`
          : raw.slice(0, 7),
      opacity: 1,
    };
  }
  return { hex: "#000000", opacity: 0.55 };
}

function parseFontWeight(w: string | number | undefined): number {
  if (typeof w === "number" && Number.isFinite(w)) {
    return Math.max(300, Math.min(900, Math.round(w)));
  }
  const s = String(w || "").toLowerCase();
  if (s.includes("bold") || s === "700" || s === "800" || s === "900") return 800;
  if (s.includes("light") || s === "300") return 300;
  if (s === "600" || s.includes("semibold")) return 600;
  const n = Number(s);
  if (Number.isFinite(n)) return Math.max(300, Math.min(900, Math.round(n)));
  return 700;
}

function inferPos(y: number, h: number): TextLayer["pos"] {
  const mid = y + h / 2;
  if (mid < 0.33) return "top";
  if (mid > 0.66) return "bottom";
  return "center";
}

function newLayerId(prefix: string, hint?: string): string {
  const base =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return hint ? `${prefix}-${hint}-${base}` : `${prefix}-${base}`;
}

function extractJsonObject(text: string): unknown | null {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence?.[1]?.trim() || trimmed;
  const match = body.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    try {
      const repaired = match[0].replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
      return JSON.parse(repaired);
    } catch {
      return null;
    }
  }
}

export function parsePrintLayoutPlan(raw: unknown): PrintLayoutPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const bg =
    typeof obj.bg_prompt === "string"
      ? obj.bg_prompt.trim()
      : typeof obj.bgPrompt === "string"
        ? obj.bgPrompt.trim()
        : "";
  if (!bg) return null;
  const list = Array.isArray(obj.elements) ? obj.elements : [];
  const elements: PrintLayoutElement[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const el = item as Record<string, unknown>;
    const type = String(el.type || "").toLowerCase();
    const x = Number(el.x);
    const y = Number(el.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const id = typeof el.id === "string" ? el.id : undefined;

    if (type === "text") {
      const text = String(el.text ?? "").trim();
      if (!text) continue;
      elements.push({
        id,
        type: "text",
        text,
        x,
        y,
        width: Number(el.width) || undefined,
        height: Number(el.height ?? el.h) || undefined,
        fontSize: typeof el.fontSize === "number" ? el.fontSize : undefined,
        fill: typeof el.fill === "string" ? el.fill : undefined,
        fontFamily: typeof el.fontFamily === "string" ? el.fontFamily : undefined,
        fontWeight:
          typeof el.fontWeight === "string" || typeof el.fontWeight === "number"
            ? el.fontWeight
            : undefined,
        align:
          el.align === "left" || el.align === "right" || el.align === "center"
            ? el.align
            : "center",
        backgroundFill:
          typeof el.backgroundFill === "string"
            ? el.backgroundFill
            : typeof el.boxFill === "string"
              ? el.boxFill
              : undefined,
        backgroundOpacity:
          typeof el.backgroundOpacity === "number"
            ? el.backgroundOpacity
            : undefined,
        cornerRadius:
          typeof el.cornerRadius === "number" ? el.cornerRadius : undefined,
        shadowColor:
          typeof el.shadowColor === "string" ? el.shadowColor : undefined,
        shadowBlur:
          typeof el.shadowBlur === "number" ? el.shadowBlur : undefined,
        shadowOffsetX:
          typeof el.shadowOffsetX === "number" ? el.shadowOffsetX : undefined,
        shadowOffsetY:
          typeof el.shadowOffsetY === "number"
            ? el.shadowOffsetY
            : typeof el.shadowOffset === "number"
              ? el.shadowOffset
              : undefined,
        stroke: typeof el.stroke === "string" ? el.stroke : undefined,
        strokeWidth:
          typeof el.strokeWidth === "number" ? el.strokeWidth : undefined,
      });
      continue;
    }

    if (type === "rect" || type === "box") {
      const width = Number(el.width);
      const height = Number(el.height ?? el.h);
      if (!Number.isFinite(width) || !Number.isFinite(height)) continue;
      elements.push({
        id,
        type: type === "box" ? "box" : "rect",
        x,
        y,
        width,
        height,
        fill: typeof el.fill === "string" ? el.fill : undefined,
        stroke: typeof el.stroke === "string" ? el.stroke : undefined,
        strokeWidth:
          typeof el.strokeWidth === "number" ? el.strokeWidth : undefined,
        cornerRadius:
          typeof el.cornerRadius === "number" ? el.cornerRadius : undefined,
      });
      continue;
    }

    if (type === "circle") {
      const radius = Number(el.radius);
      const width = Number(el.width);
      const height = Number(el.height);
      if (!Number.isFinite(radius) && !Number.isFinite(width)) continue;
      elements.push({
        id,
        type: "circle",
        x,
        y,
        radius: Number.isFinite(radius) ? radius : undefined,
        width: Number.isFinite(width) ? width : undefined,
        height: Number.isFinite(height) ? height : undefined,
        fill: typeof el.fill === "string" ? el.fill : undefined,
        stroke: typeof el.stroke === "string" ? el.stroke : undefined,
        strokeWidth:
          typeof el.strokeWidth === "number" ? el.strokeWidth : undefined,
      });
      continue;
    }

    if (type === "line") {
      elements.push({
        id,
        type: "line",
        x,
        y,
        width: Number(el.width) || undefined,
        height: Number(el.height) || undefined,
        x2: Number(el.x2) || undefined,
        y2: Number(el.y2) || undefined,
        fill: typeof el.fill === "string" ? el.fill : undefined,
        stroke: typeof el.stroke === "string" ? el.stroke : undefined,
        strokeWidth:
          typeof el.strokeWidth === "number" ? el.strokeWidth : undefined,
      });
      continue;
    }

    if (type === "icon") {
      const rawName =
        typeof el.iconName === "string"
          ? el.iconName
          : typeof el.name === "string"
            ? el.name
            : typeof el.text === "string"
              ? el.text
              : "";
      if (!rawName || isEmojiGlyph(rawName)) continue;
      const iconName = normalizeLucideIconName(rawName);
      if (!iconName) continue;
      elements.push({
        id,
        type: "icon",
        iconName,
        x,
        y,
        size: typeof el.size === "number" ? el.size : undefined,
        width: Number(el.width) || undefined,
        height: Number(el.height) || undefined,
        fill:
          typeof el.fill === "string"
            ? el.fill
            : typeof el.color === "string"
              ? el.color
              : undefined,
        color: typeof el.color === "string" ? el.color : undefined,
      });
      continue;
    }

    if (type === "shape") {
      const shapeType =
        parseDecoShapeType(el.shapeType) ||
        parseDecoShapeType(el.shape) ||
        parseDecoShapeType(el.kind);
      if (!shapeType) continue;
      const width = Number(el.width);
      const height = Number(el.height ?? el.h);
      if (!Number.isFinite(width) || !Number.isFinite(height)) continue;
      elements.push({
        id,
        type: "shape",
        shapeType,
        x,
        y,
        width,
        height,
        fill: typeof el.fill === "string" ? el.fill : undefined,
        stroke: typeof el.stroke === "string" ? el.stroke : undefined,
        strokeWidth:
          typeof el.strokeWidth === "number" ? el.strokeWidth : undefined,
        cornerRadius:
          typeof el.cornerRadius === "number" ? el.cornerRadius : undefined,
      });
    }
  }

  if (!elements.length) return null;
  return { bg_prompt: bg, elements };
}

export function parsePrintLayoutPlanFromText(
  text: string
): PrintLayoutPlan | null {
  return parsePrintLayoutPlan(extractJsonObject(text));
}

function makePlateLayer(opts: {
  id?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
  stroke?: string;
  cornerRadiusPx?: number;
  circle?: boolean;
  stageW: number;
  stageH: number;
}): TextLayer {
  const fill = parseRgba(opts.fill);
  const minSide = Math.min(opts.w * opts.stageW, opts.h * opts.stageH) || 1;
  const radiusFrac = opts.circle
    ? 0.5
    : Math.max(
        0,
        Math.min(0.5, (opts.cornerRadiusPx ?? 8) / minSide)
      );
  return createLayer({
    id: opts.id || newLayerId("plate"),
    text: "\u200B",
    pos: inferPos(opts.y, opts.h),
    layoutLocked: true,
    boxManual: true,
    manualX: opts.x,
    manualY: opts.y,
    boxW: opts.w,
    boxH: opts.h,
    maxWidth: opts.w,
    showBox: true,
    showBoxBorder: Boolean(opts.stroke),
    boxBorderColor: opts.stroke
      ? parseRgba(opts.stroke).hex
      : undefined,
    boxColor: fill.hex,
    boxOpacity: fill.opacity,
    boxRadius: radiusFrac,
    color: "white",
    fontSize: 12,
    fontWeight: 400,
    align: "center",
    fontPreset: "pretendard",
  });
}

/**
 * Map Gemini layout → Screen-26 layers (HTML overlay + export-safe).
 * Plates/circles/lines → TextLayer showBox; icons → Lucide SVG deco;
 * decorative shapes → vector deco; text → TextLayer (merged into plates when nested).
 */
export function mapLayoutPlanToCanvasLayers(
  plan: PrintLayoutPlan,
  stageW: number,
  stageH: number,
  toneHints?: {
    styleLabel?: string;
    useLabel?: string;
    backgroundFieldLabel?: string;
    categoryLabel?: string;
    prompt?: string;
  }
): MappedLayoutLayers {
  const short = Math.min(stageW, stageH) || 1080;
  const textLayers: TextLayer[] = [];
  const decoLayers: PrintDecoLayer[] = [];
  let decoStack = 0;

  const elements = plan.elements.slice(0, 40);
  const usePixels = layoutPlanUsesPixels(elements, stageW, stageH);
  const sceneTone = inferBackgroundTone(
    plan.bg_prompt,
    toneHints?.styleLabel,
    toneHints?.useLabel,
    toneHints?.backgroundFieldLabel,
    toneHints?.categoryLabel,
    toneHints?.prompt
  );

  const plates: PixelRect[] = [];
  const texts: PixelText[] = [];
  const lines: PrintLayoutElementLine[] = [];
  const icons: PrintLayoutElementIcon[] = [];
  const shapes: PrintLayoutElementShape[] = [];

  const appearanceForText = (
    el: PrintLayoutElementText,
    localBackdropHex?: string,
    localBackdropOpacity?: number
  ) =>
    resolveContrastTextAppearance({
      fill: el.fill,
      sceneTone,
      localBackdropHex,
      localBackdropOpacity,
      shadowColor: el.shadowColor,
      shadowBlur: el.shadowBlur,
      shadowOffsetX: el.shadowOffsetX,
      shadowOffsetY: el.shadowOffsetY,
      stroke: el.stroke,
      strokeWidth: el.strokeWidth,
    });

  type ContrastBackdrop = {
    x: number;
    y: number;
    w: number;
    h: number;
    hex: string;
    opacity: number;
  };

  const findImmediateBackdrop = (
    cx: number,
    cy: number,
    candidates: ContrastBackdrop[]
  ): ContrastBackdrop | null => {
    let best: ContrastBackdrop | null = null;
    let bestArea = Number.POSITIVE_INFINITY;
    for (const box of candidates) {
      const pad = Math.min(box.w, box.h) * 0.04;
      if (!rectContainsPoint(box, cx, cy, pad)) continue;
      const area = box.w * box.h;
      if (area < bestArea) {
        bestArea = area;
        best = box;
      }
    }
    return best;
  };

  elements.forEach((el, sourceIndex) => {
    if (el.type === "rect" || el.type === "box") {
      const box = clampBoxPx(
        toStagePixels(el.x, stageW, usePixels),
        toStagePixels(el.y, stageH, usePixels),
        Math.max(8, toStagePixels(el.width, stageW, usePixels)),
        Math.max(8, toStagePixels(el.height, stageH, usePixels)),
        stageW,
        stageH
      );
      plates.push({
        ...box,
        fill: el.fill,
        stroke: el.stroke,
        cornerRadius: el.cornerRadius,
        id: el.id,
        sourceIndex,
      });
      return;
    }

    if (el.type === "circle") {
      const rRaw =
        typeof el.radius === "number" && el.radius > 0
          ? el.radius
          : Math.max(Number(el.width) || 0, Number(el.height) || 0) / 2 ||
            short * 0.04;
      const cx = toStagePixels(el.x, stageW, usePixels);
      const cy = toStagePixels(el.y, stageH, usePixels);
      const r = usePixels
        ? rRaw
        : rRaw <= 1
          ? rRaw * short
          : rRaw;
      const size = Math.max(16, r * 2);
      const box = clampBoxPx(cx - r, cy - r, size, size, stageW, stageH);
      const side = Math.min(box.w, box.h);
      plates.push({
        x: box.x,
        y: box.y,
        w: side,
        h: side,
        fill: el.fill || "rgba(230,126,34,0.95)",
        stroke: el.stroke,
        circle: true,
        id: el.id,
        sourceIndex,
      });
      return;
    }

    if (el.type === "line") {
      lines.push(el);
      return;
    }

    if (el.type === "icon") {
      icons.push(el);
      return;
    }

    if (el.type === "shape") {
      shapes.push(el);
      return;
    }

    if (el.type === "text") {
      const fontSize =
        typeof el.fontSize === "number" && el.fontSize > 0
          ? usePixels
            ? el.fontSize
            : el.fontSize <= 1
              ? el.fontSize * short
              : el.fontSize
          : Math.round(short * 0.045);
      const rawW =
        typeof el.width === "number" && el.width > 0
          ? toStagePixels(el.width, stageW, usePixels)
          : stageW * 0.8;
      const rawH =
        typeof el.height === "number" && el.height > 0
          ? toStagePixels(el.height, stageH, usePixels)
          : fontSize * 1.45;
      const rawX = toStagePixels(el.x, stageW, usePixels);
      const rawY = toStagePixels(el.y, stageH, usePixels);
      texts.push({
        el,
        x: rawX,
        y: rawY,
        w: rawW,
        h: rawH,
        fontSize,
        sourceIndex,
      });
    }
  });

  // Detach text.backgroundFill into pure plates (never tattoo text onto a box).
  let bgPlateSeq = 0;
  for (const text of texts) {
    if (!text.el.backgroundFill) continue;
    const bg = parseRgba(text.el.backgroundFill);
    plates.push({
      x: text.x,
      y: text.y,
      w: text.w,
      h: Math.max(text.h, text.fontSize * 1.6),
      fill: text.el.backgroundFill,
      cornerRadius: text.el.cornerRadius,
      id: text.el.id ? `${text.el.id}-bg` : `text-bg-${bgPlateSeq++}`,
      sourceIndex: text.sourceIndex,
    });
    text.el = {
      ...text.el,
      backgroundFill: undefined,
      backgroundOpacity: undefined,
    };
    void bg;
  }

  // Expand multiline info blobs + snap 2-column label/value grids.
  const gridSeeds = expandInfoGridSeeds(
    texts.map((t) => ({
      el: t.el,
      x: t.x,
      y: t.y,
      w: t.w,
      h: t.h,
      fontSize: t.fontSize,
      sourceIndex: t.sourceIndex,
    })),
    stageW
  );

  // Pure backdrop plates first (ZWSP showBox only — no copy).
  plates.forEach((plate) => {
    textLayers.push(
      makePlateLayer({
        id: plate.id,
        x: plate.x / stageW,
        y: plate.y / stageH,
        w: plate.w / stageW,
        h: plate.h / stageH,
        fill: plate.fill,
        stroke: plate.stroke,
        cornerRadiusPx: plate.cornerRadius,
        circle: plate.circle,
        stageW,
        stageH,
      })
    );
  });

  // Lines stay as thin plates.
  for (const el of lines) {
    let x1 = toStagePixels(el.x, stageW, usePixels);
    let y1 = toStagePixels(el.y, stageH, usePixels);
    let x2 =
      typeof el.x2 === "number"
        ? toStagePixels(el.x2, stageW, usePixels)
        : undefined;
    let y2 =
      typeof el.y2 === "number"
        ? toStagePixels(el.y2, stageH, usePixels)
        : undefined;
    let left: number;
    let top: number;
    let widthPx: number;
    let heightPx: number;
    if (
      typeof x2 === "number" &&
      typeof y2 === "number" &&
      Number.isFinite(x2) &&
      Number.isFinite(y2)
    ) {
      left = Math.min(x1, x2);
      top = Math.min(y1, y2);
      widthPx = Math.max(4, Math.abs(x2 - x1));
      heightPx = Math.max(
        el.strokeWidth || 3,
        Math.abs(y2 - y1) || el.strokeWidth || 3
      );
    } else {
      left = x1;
      top = y1;
      widthPx =
        typeof el.width === "number" && el.width > 0
          ? toStagePixels(el.width, stageW, usePixels)
          : stageW * 0.7;
      heightPx = Math.max(
        2,
        typeof el.height === "number" && el.height > 0
          ? toStagePixels(el.height, stageH, usePixels)
          : el.strokeWidth || 3
      );
    }
    const box = clampBoxPx(left, top, widthPx, heightPx, stageW, stageH);
    textLayers.push(
      makePlateLayer({
        id: el.id,
        x: box.x / stageW,
        y: box.y / stageH,
        w: box.w / stageW,
        h: box.h / stageH,
        fill: el.stroke || el.fill || "rgba(255,255,255,0.85)",
        cornerRadiusPx: 2,
        stageW,
        stageH,
      })
    );
  }

  // Independent text atoms (never showBox — plates are separate layers).
  for (const seed of gridSeeds) {
    const el = seed.el as PrintLayoutElementText;
    const isInfoAtom =
      seed.el.id?.includes("info-") ||
      seed.el.id?.includes("-label-") ||
      seed.el.id?.includes("-value-");
    const normalized = isInfoAtom
      ? {
          x: seed.x,
          y: seed.y,
          w: seed.w,
          h: seed.h,
          align: (el.align || "left") as "left" | "center" | "right",
        }
      : normalizeStandaloneTextBox(
          seed.x,
          seed.y,
          seed.w,
          seed.h,
          seed.fontSize,
          el.align,
          stageW,
          stageH,
          el.text
        );

    // Contrast vs the smallest containing plate/shape (box-local luminance wins).
    const cx = normalized.x + normalized.w / 2;
    const cy = normalized.y + normalized.h / 2;
    const backdrops: ContrastBackdrop[] = [];
    for (const plate of plates) {
      const parsed = parseFillColor(plate.fill);
      if (!parsed) continue;
      backdrops.push({
        x: plate.x,
        y: plate.y,
        w: plate.w,
        h: plate.h,
        hex: parsed.hex,
        opacity: parsed.opacity,
      });
    }
    for (const shape of shapes) {
      const parsed = parseFillColor(shape.fill);
      if (!parsed) continue;
      const st = parseDecoShapeType(shape.shapeType);
      if (st === "line" || st === "frame") continue;
      backdrops.push({
        x: toStagePixels(shape.x, stageW, usePixels),
        y: toStagePixels(shape.y, stageH, usePixels),
        w: Math.max(8, toStagePixels(shape.width, stageW, usePixels)),
        h: Math.max(8, toStagePixels(shape.height, stageH, usePixels)),
        hex: parsed.hex,
        opacity: parsed.opacity,
      });
    }
    const under = findImmediateBackdrop(cx, cy, backdrops);
    const contrast = appearanceForText(
      el,
      under?.hex,
      under?.opacity
    );
    // color stays an independent TextLayer field — user can recolor anytime.
    textLayers.push(
      createLayer({
        id: el.id || newLayerId("text"),
        text: el.text,
        pos: inferPos(normalized.y / stageH, normalized.h / stageH),
        layoutLocked: true,
        boxManual: true,
        manualX: normalized.x / stageW,
        manualY: normalized.y / stageH,
        boxW: normalized.w / stageW,
        boxH: normalized.h / stageH,
        maxWidth: normalized.w / stageW,
        showBox: false,
        showBoxBorder: false,
        boxOpacity: 0,
        color: contrast.color as TextLayer["color"],
        fontSize: seed.fontSize,
        fontWeight: parseFontWeight(el.fontWeight),
        align: normalized.align,
        lineHeight: 1.25,
        fontPreset: "pretendard",
        textShadowColor: contrast.textShadowColor,
        textShadowBlur: contrast.textShadowBlur,
        textShadowOffsetX: contrast.textShadowOffsetX,
        textShadowOffsetY: contrast.textShadowOffsetY,
        textStroke: contrast.textStroke,
        textStrokeWidth: contrast.textStrokeWidth,
      })
    );
  }

  for (const el of icons) {
    const sizePx =
      typeof el.size === "number" && el.size > 0
        ? toStagePixels(el.size, short, usePixels)
        : typeof el.width === "number" && el.width > 0
          ? toStagePixels(el.width, stageW, usePixels)
          : short * 0.045;
    const left = toStagePixels(el.x, stageW, usePixels);
    const top = toStagePixels(el.y, stageH, usePixels);
    const size = Math.max(14, Math.min(short * 0.12, sizePx));
    const color = el.color || el.fill || "#1f2937";
    const layer = createLucideDecoLayer({
      id: el.id || newLayerId("icon", String(decoStack++)),
      lucideIcon: el.iconName,
      stageW,
      stageH,
      x: left,
      y: top,
      size,
      color,
    });
    if (layer) decoLayers.push(layer);
  }

  for (const el of shapes) {
    const shapeType = parseDecoShapeType(el.shapeType);
    if (!shapeType) continue;
    decoLayers.push(
      createShapeDecoLayer({
        id: el.id || newLayerId("shape", String(decoStack++)),
        shapeType,
        stageW,
        stageH,
        x: toStagePixels(el.x, stageW, usePixels),
        y: toStagePixels(el.y, stageH, usePixels),
        width: Math.max(
          8,
          toStagePixels(el.width, stageW, usePixels)
        ),
        height: Math.max(
          shapeType === "line" ? 4 : 8,
          toStagePixels(el.height, stageH, usePixels)
        ),
        fill: el.fill,
        stroke: el.stroke,
        strokeWidth: el.strokeWidth,
        cornerRadius: el.cornerRadius,
      })
    );
  }

  return { textLayers, decoLayers };
}

/** @deprecated Use mapLayoutPlanToCanvasLayers — kept for callers expecting TextLayer[] only. */
export function mapLayoutElementsToTextLayers(
  plan: PrintLayoutPlan,
  stageW: number,
  stageH: number
): TextLayer[] {
  return mapLayoutPlanToCanvasLayers(plan, stageW, stageH).textLayers;
}

export function buildLayoutUserPrompt(req: GenerateLayoutRequest): string {
  const pageHint =
    typeof req.pageIndex === "number" && typeof req.pageCount === "number"
      ? `page ${req.pageIndex + 1} of ${req.pageCount}`
      : "page 1";
  const W = Math.round(req.canvasWidth);
  const H = Math.round(req.canvasHeight);
  return [
    `Canvas size (pixels): ${W} x ${H}`,
    `규격(size): ${req.formatLabel}`,
    `스타일(style): ${req.styleLabel}`,
    `용도(purpose): ${req.useLabel}`,
    `배경/분야(background/category): ${req.backgroundFieldLabel}${
      req.categoryLabel ? ` / ${req.categoryLabel}` : ""
    }`,
    `User prompt / theme: ${req.prompt.trim() || "elegant modern print"}`,
    `Face: ${pageHint}`,
    `Design a finished Canva-quality ATOMIC layout for this single page.`,
    `Choose element count and structure dynamically for this purpose — do not use a fixed template.`,
    `COORDINATES: every x,y,width,height,fontSize MUST be PIXELS for ${W}x${H} only (top-left origin).`,
    `Centered element formula: x = (${W} - elementWidth) / 2. Never put the center point into x.`,
    `Main title / hero headline: x=0, width=${W}, align="center".`,
    `ATOMIC: rect/shape = pure backdrop only. Every text string is a separate text node (never glued into a box).`,
    `INFO GRID: 일시/장소/입장 etc. = two columns (shared labelX + shared valueX), row y step exactly 32px. No multiline blobs.`,
    `ICONS: Lucide kebab-case vectors only — zero emoji. Never default to calendar/map-pin/gift/trophy.`,
    `Prefer 2–6 decorative shapes (ribbon/frame/pill/stamp/line) + 0–4 unique theme icons.`,
    `CONTRAST: Text on a dark box → light fill (#FFF / ivory / pastel yellow). Text on a light box → dark fill (#1A1A1A / brown / navy). Never dark-on-dark.`,
    `If using light type on complex/light photo, add shadowColor+shadowBlur or a translucent backdrop rect.`,
  ].join("\n");
}
