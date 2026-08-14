/**
 * Client-side atmospheric background for Step 2 preview.
 * Swap this module later for a real Fal / generate call without touching UI.
 */

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

export async function generatePrintBackgroundDataUrl(
  keyword: string,
  aspect: number
): Promise<string> {
  const w = 1200;
  const h = Math.max(400, Math.round(w / Math.max(0.3, aspect)));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");

  const seed = hashKeyword(keyword.trim() || "print");
  const [c0, c1, c2] = PALETTES[seed % PALETTES.length];

  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, c0);
  g.addColorStop(0.45, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Soft orbs
  for (let i = 0; i < 5; i++) {
    const x = ((seed * (i + 3)) % w) * 0.85 + w * 0.05;
    const y = ((seed * (i + 7)) % h) * 0.8 + h * 0.05;
    const r = Math.min(w, h) * (0.18 + ((seed >> (i + 2)) % 20) / 100);
    const orb = ctx.createRadialGradient(x, y, 0, x, y, r);
    orb.addColorStop(0, `rgba(255,255,255,${0.12 + (i % 3) * 0.04})`);
    orb.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = orb;
    ctx.fillRect(0, 0, w, h);
  }

  // Vignette
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

  // Keyword watermark (subtle)
  const label = (keyword.trim() || "Studio Canvas Print").slice(0, 48);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.font = `600 ${Math.round(Math.min(w, h) * 0.035)}px Pretendard, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(label, w / 2, h * 0.92);

  // Brief async feel for UX loading
  await new Promise((r) => setTimeout(r, 650 + (seed % 400)));

  return canvas.toDataURL("image/jpeg", 0.88);
}
