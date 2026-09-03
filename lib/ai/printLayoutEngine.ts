/**
 * Screen-26 Magic Layout Engine — Gemini JSON → TextLayer assembly.
 * Coordinates are normalized 0–1 relative to the print stage (warehouse style).
 */

import { createLayer, type ColorPreset, type TextLayer } from "@/lib/thumbnailStyles";

export type PrintLayoutElementBox = {
  id?: string;
  type: "box";
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  cornerRadius?: number;
};

export type PrintLayoutElementText = {
  id?: string;
  type: "text";
  text: string;
  x: number;
  y: number;
  width: number;
  height?: number;
  fontSize?: number;
  fill?: string;
  fontFamily?: string;
  fontWeight?: string | number;
  align?: "left" | "center" | "right";
  /** Optional plate behind the text */
  backgroundFill?: string;
  backgroundOpacity?: number;
  cornerRadius?: number;
};

export type PrintLayoutElement =
  | PrintLayoutElementBox
  | PrintLayoutElementText;

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

export const PRINT_LAYOUT_SYSTEM_INSTRUCTION = `You are a 20-year senior graphic designer and Korean copywriter for print/flyer/poster design (Canva Magic Studio level).

Given print specs and a user theme, return ONE JSON object only (no markdown, no commentary) with this exact shape:
{
  "bg_prompt": "English Flux.1 background prompt with cinematic lighting, professional print quality, and explicit negative-space / off-center composition so overlay text stays readable. NEVER include letters, logos, watermarks, or readable text in the image.",
  "elements": [
    {
      "id": "elem-1",
      "type": "box",
      "x": 0.06,
      "y": 0.08,
      "width": 0.88,
      "height": 0.14,
      "fill": "rgba(0,0,0,0.55)",
      "cornerRadius": 12
    },
    {
      "id": "elem-2",
      "type": "text",
      "text": "완성형 한국어 카피",
      "x": 0.08,
      "y": 0.1,
      "width": 0.84,
      "height": 0.1,
      "fontSize": 52,
      "fill": "#FFFFFF",
      "fontFamily": "Pretendard, sans-serif",
      "fontWeight": "bold",
      "align": "center",
      "backgroundFill": "rgba(0,0,0,0.45)",
      "backgroundOpacity": 0.9,
      "cornerRadius": 10
    }
  ]
}

Hard rules:
1. Coordinates x,y,width,height MUST be normalized fractions of the canvas (0–1). Top-left origin.
2. Keep all elements inside a safe margin of 0.04–0.96.
3. Write complete Korean copy matching 용도/분야/prompt: main title, subtitle, date/place/info lines, organizer/contact as needed. Do NOT leave placeholder lorem.
4. Prefer 4–8 elements: optional dark/light plates (type box) + text layers. Text may include backgroundFill for readability badges.
5. fontSize is CSS-like px relative to a ~1080 short-side reference (typical title 42–72, body 22–34).
6. bg_prompt must be English only, emphasize negative space for text, no people faces unless the theme requires them, never render text in the background image.
7. Return STRICT JSON only.`;

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
  if (treatAsPixelIfGt1 && value > 1 && axisSize > 0) {
    return clamp01(value / axisSize);
  }
  return clamp01(value);
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
    return { hex: raw.length === 4 ? `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}` : raw.slice(0, 7), opacity: 1 };
  }
  return { hex: "#000000", opacity: 0.55 };
}

function nearestTextColor(fill: string | undefined): ColorPreset | string {
  const { hex } = parseRgba(fill);
  const h = hex.toUpperCase();
  if (h === "#FFFFFF" || h === "#FFF") return "white";
  if (h === "#000000" || h === "#000") return "inkBlack";
  if (h === "#FACC15" || h === "#F59E0B") return "yellow";
  // Preserve exact hex — PreviewTextOverlay / warehouse path accepts #RRGGBB.
  return hex;
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
    const width = Number(el.width);
    const height = Number(el.height ?? el.h ?? 0);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width)) {
      continue;
    }
    if (type === "box") {
      elements.push({
        id: typeof el.id === "string" ? el.id : undefined,
        type: "box",
        x,
        y,
        width,
        height: Number.isFinite(height) && height > 0 ? height : 0.08,
        fill: typeof el.fill === "string" ? el.fill : undefined,
        cornerRadius:
          typeof el.cornerRadius === "number" ? el.cornerRadius : undefined,
      });
      continue;
    }
    if (type === "text") {
      const text = String(el.text ?? "").trim();
      if (!text) continue;
      elements.push({
        id: typeof el.id === "string" ? el.id : undefined,
        type: "text",
        text,
        x,
        y,
        width,
        height: Number.isFinite(height) && height > 0 ? height : undefined,
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

/**
 * Map Gemini layout elements → Screen-26 TextLayer[] (absolute warehouse geometry).
 * Box-only plates become empty text layers with showBox (editable / deletable).
 */
export function mapLayoutElementsToTextLayers(
  plan: PrintLayoutPlan,
  stageW: number,
  stageH: number
): TextLayer[] {
  const short = Math.min(stageW, stageH) || 1080;
  const layers: TextLayer[] = [];

  for (const el of plan.elements) {
    const x = toNormalized(el.x, stageW);
    const y = toNormalized(el.y, stageH);
    const w = Math.max(0.04, toNormalized(el.width, stageW));
    const hRaw =
      el.type === "box"
        ? el.height
        : el.height ??
          Math.max(
            0.04,
            ((el.fontSize ?? 40) * 1.4) / (stageH || short)
          );
    const h = Math.max(0.03, toNormalized(hRaw, stageH));

    if (el.type === "box") {
      const fill = parseRgba(el.fill);
      const radiusPx = el.cornerRadius ?? 8;
      const minSide = Math.min(w * stageW, h * stageH) || 1;
      layers.push(
        createLayer({
          id: el.id || undefined,
          text: "\u200B",
          pos: inferPos(y, h),
          layoutLocked: true,
          boxManual: true,
          manualX: x,
          manualY: y,
          boxW: w,
          boxH: h,
          maxWidth: w,
          showBox: true,
          showBoxBorder: false,
          boxColor: fill.hex,
          boxOpacity: fill.opacity,
          boxRadius: Math.max(0, Math.min(0.5, radiusPx / minSide)),
          color: "white",
          fontSize: 12,
          fontWeight: 400,
          align: "center",
          fontPreset: "pretendard",
        })
      );
      continue;
    }

    const fontSize =
      typeof el.fontSize === "number" && el.fontSize > 0
        ? el.fontSize
        : Math.round(short * 0.045);
    const bg = el.backgroundFill
      ? parseRgba(el.backgroundFill)
      : null;
    const opacity =
      typeof el.backgroundOpacity === "number"
        ? Math.max(0, Math.min(1, el.backgroundOpacity))
        : bg?.opacity ?? 0.85;
    const radiusPx = el.cornerRadius ?? 8;
    const minSide = Math.min(w * stageW, h * stageH) || 1;

    layers.push(
      createLayer({
        id: el.id || undefined,
        text: el.text,
        pos: inferPos(y, h),
        layoutLocked: true,
        boxManual: true,
        manualX: x,
        manualY: y,
        boxW: w,
        boxH: h,
        maxWidth: w,
        showBox: Boolean(bg),
        showBoxBorder: false,
        boxColor: bg?.hex ?? "#000000",
        boxOpacity: bg ? opacity : 0,
        boxRadius: Math.max(0, Math.min(0.5, radiusPx / minSide)),
        color: nearestTextColor(el.fill) as TextLayer["color"],
        fontSize,
        fontWeight: parseFontWeight(el.fontWeight),
        align: el.align ?? "center",
        lineHeight: 1.25,
        fontPreset: "pretendard",
      })
    );
  }

  return layers;
}

export function buildLayoutUserPrompt(req: GenerateLayoutRequest): string {
  const pageHint =
    typeof req.pageIndex === "number" && typeof req.pageCount === "number"
      ? `page ${req.pageIndex + 1} of ${req.pageCount}`
      : "page 1";
  return [
    `Canvas size: ${Math.round(req.canvasWidth)} x ${Math.round(req.canvasHeight)} px`,
    `규격(size): ${req.formatLabel}`,
    `스타일(style): ${req.styleLabel}`,
    `용도(purpose): ${req.useLabel}`,
    `배경/분야(background/category): ${req.backgroundFieldLabel}${
      req.categoryLabel ? ` / ${req.categoryLabel}` : ""
    }`,
    `User prompt / theme: ${req.prompt.trim() || "elegant modern print"}`,
    `Face: ${pageHint}`,
    `Produce a finished Canva-quality layout JSON for this single page.`,
  ].join("\n");
}
