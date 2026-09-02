/**
 * Print Step 2 background generation — Fal via /api/ai-background.
 * Falls back to a local atmospheric gradient only if the API is unreachable
 * and `allowMockFallback` is true (default false).
 */

import { requestAiBackground } from "@/lib/aiBackground";
import type { PrintBackgroundPan } from "@/lib/printWizardTypes";

const PALETTES: Array<[string, string, string]> = [
  ["#1a1030", "#4c1d95", "#0f766e"],
  ["#0c1222", "#1e3a5f", "#b45309"],
  ["#1c1917", "#7c2d12", "#9f1239"],
  ["#0f172a", "#312e81", "#155e75"],
  ["#18181b", "#3f3f46", "#a21caf"],
  ["#14213d", "#f72585", "#4cc9f0"],
];

function hashKeyword(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export type PrintBgGenerateParams = {
  keyword: string;
  aspect: number;
  /** 0-based page index for variation. */
  pageIndex?: number;
  pageCount?: number;
  formatLabel?: string;
  useLabel?: string;
  allowMockFallback?: boolean;
  imageStyleId?: string | null;
  moodStyleId?: string | null;
};

export const DEFAULT_BG_PAN: PrintBackgroundPan = { x: 0, y: 0 };
/** Drag distance (as fraction of frame) → pan units. */
export const BG_PAN_SENSITIVITY = 2;

export function clampBgPanAxis(v: number): number {
  return Math.max(-1, Math.min(1, v));
}

export function normalizeBgPan(
  pan?: Partial<PrintBackgroundPan> | null
): PrintBackgroundPan {
  const x = typeof pan?.x === "number" && Number.isFinite(pan.x) ? pan.x : 0;
  const y = typeof pan?.y === "number" && Number.isFinite(pan.y) ? pan.y : 0;
  return { x: clampBgPanAxis(x), y: clampBgPanAxis(y) };
}

/** CSS object-position for object-cover; 0–100% never exposes empty edges. */
export function bgPanObjectPosition(
  pan?: Partial<PrintBackgroundPan> | null
): string {
  const p = normalizeBgPan(pan);
  return `${((p.x + 1) / 2) * 100}% ${((p.y + 1) / 2) * 100}%`;
}

export function resizeBackgroundPans(
  prev: PrintBackgroundPan[] | undefined,
  pageCount: number
): PrintBackgroundPan[] {
  const out: PrintBackgroundPan[] = [];
  for (let i = 0; i < pageCount; i++) {
    out.push(normalizeBgPan(prev?.[i]));
  }
  return out;
}

export function sanitizeBackgroundPans(
  raw: unknown
): PrintBackgroundPan[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.map((item) => {
    if (!item || typeof item !== "object") return { ...DEFAULT_BG_PAN };
    const obj = item as Record<string, unknown>;
    return normalizeBgPan({
      x: typeof obj.x === "number" ? obj.x : Number(obj.x),
      y: typeof obj.y === "number" ? obj.y : Number(obj.y),
    });
  });
}

/** Prefer that page's own URL — never copy page 1 onto later faces. */
export function pageBackgroundUrl(
  urls: Array<string | null | undefined> | undefined,
  fallback: string | null | undefined,
  pageIndex: number
): string | null {
  const own = urls?.[pageIndex];
  if (typeof own === "string" && own) return own;
  if (pageIndex === 0 && typeof fallback === "string" && fallback) {
    return fallback;
  }
  return null;
}

/** First empty background slot (0-based), or -1 when every page slot is filled. */
export function nextEmptyBackgroundPageIndex(
  urls: Array<string | null | undefined> | undefined,
  fallback: string | null | undefined,
  pageCount: number
): number {
  const count = Math.max(1, Math.min(10, pageCount));
  for (let i = 0; i < count; i++) {
    if (!pageBackgroundUrl(urls, fallback, i)) return i;
  }
  return -1;
}

async function generateMockBackgroundDataUrl(
  params: PrintBgGenerateParams
): Promise<string> {
  const keyword = params.keyword.trim() || "print";
  const aspect = Math.max(0.3, params.aspect || 1);
  const pageIndex = params.pageIndex ?? 0;
  const w = 1200;
  const h = Math.max(400, Math.round(w / aspect));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");

  const seed = hashKeyword(
    `${keyword}|${pageIndex}|${params.formatLabel ?? ""}|${params.useLabel ?? ""}`
  );
  const [c0, c1, c2] = PALETTES[seed % PALETTES.length];

  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, c0);
  g.addColorStop(0.45, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 5; i++) {
    const x = ((seed * (i + 3 + pageIndex)) % w) * 0.85 + w * 0.05;
    const y = ((seed * (i + 7 + pageIndex * 2)) % h) * 0.8 + h * 0.05;
    const r = Math.min(w, h) * (0.18 + ((seed >> (i + 2)) % 20) / 100);
    const orb = ctx.createRadialGradient(x, y, 0, x, y, r);
    orb.addColorStop(0, `rgba(255,255,255,${0.12 + (i % 3) * 0.04})`);
    orb.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = orb;
    ctx.fillRect(0, 0, w, h);
  }

  const vig = ctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.2,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.7
  );
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  const meta = [params.formatLabel, params.useLabel, `${pageIndex + 1}면`]
    .filter(Boolean)
    .join(" · ");
  // Visual mock only — never burn form copy into the bitmap (layer separation).
  void meta;
  void keyword;

  return canvas.toDataURL("image/jpeg", 0.88);
}

export async function generatePrintBackgroundDataUrl(
  keywordOrParams: string | PrintBgGenerateParams,
  aspectMaybe?: number
): Promise<string> {
  const params: PrintBgGenerateParams =
    typeof keywordOrParams === "string"
      ? { keyword: keywordOrParams, aspect: aspectMaybe ?? 1 }
      : keywordOrParams;

  const keyword = params.keyword.trim() || "print";
  const aspect = Math.max(0.3, params.aspect || 1);
  const pageIndex = params.pageIndex ?? 0;

  try {
    // Unified print context (options + keyword tags) as a single prompt.
    const { imageUrl } = await requestAiBackground({
      prompt: keyword,
      aspectRatio: String(aspect),
      pageIndex,
      pageCount: params.pageCount,
      imageStyleId: params.imageStyleId,
      moodStyleId: params.moodStyleId,
    });
    return imageUrl;
  } catch (err) {
    if (params.allowMockFallback) {
      return generateMockBackgroundDataUrl(params);
    }
    throw err;
  }
}

/** Generate one distinct background per page for the current print plan. */
export async function generatePrintBackgroundPages(params: {
  keyword: string;
  keywords?: string[];
  aspect: number;
  pageCount: number;
  formatLabel?: string;
  useLabel?: string;
  allowMockFallback?: boolean;
  imageStyleId?: string | null;
  moodStyleId?: string | null;
}): Promise<string[]> {
  const count = Math.max(1, Math.min(10, params.pageCount));
  const urls: string[] = Array.from({ length: count }, () => "");
  for (let i = 0; i < count; i++) {
    const keyword = (params.keywords?.[i] || params.keyword).trim();
    try {
      urls[i] = await generatePrintBackgroundDataUrl({
        keyword,
        aspect: params.aspect,
        pageIndex: i,
        pageCount: count,
        formatLabel: params.formatLabel,
        useLabel: params.useLabel,
        allowMockFallback: params.allowMockFallback,
        imageStyleId: params.imageStyleId,
        moodStyleId: params.moodStyleId,
      });
    } catch (err) {
      if (i === 0) throw err;
      console.error("[print-wizard] page background failed", i, err);
    }
  }
  if (!urls[0]) {
    throw new Error("AI 배경 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.");
  }
  return urls;
}
