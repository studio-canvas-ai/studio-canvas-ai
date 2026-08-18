/**
 * Print Step 2 background generation — Fal via /api/ai-background.
 * Falls back to a local atmospheric gradient only if the API is unreachable
 * and `allowMockFallback` is true (default false).
 */

import { requestAiBackground } from "@/lib/aiBackground";

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
  formatLabel?: string;
  useLabel?: string;
  allowMockFallback?: boolean;
  imageStyleId?: string | null;
  moodStyleId?: string | null;
};

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

/** Generate one background per page for the current print plan. */
export async function generatePrintBackgroundPages(params: {
  keyword: string;
  aspect: number;
  pageCount: number;
  formatLabel?: string;
  useLabel?: string;
  allowMockFallback?: boolean;
  imageStyleId?: string | null;
  moodStyleId?: string | null;
}): Promise<string[]> {
  const count = Math.max(1, Math.min(10, params.pageCount));
  const urls: string[] = [];
  for (let i = 0; i < count; i++) {
    urls.push(
      await generatePrintBackgroundDataUrl({
        keyword: params.keyword,
        aspect: params.aspect,
        pageIndex: i,
        formatLabel: params.formatLabel,
        useLabel: params.useLabel,
        allowMockFallback: params.allowMockFallback,
        imageStyleId: params.imageStyleId,
        moodStyleId: params.moodStyleId,
      })
    );
  }
  return urls;
}
