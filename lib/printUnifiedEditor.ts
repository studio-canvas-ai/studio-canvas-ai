/** Screen 26 — one-page unified print editor (independent from Screen 8 / 24 wizard). */
export const PRINT_UNIFIED_EDITOR_PATH = "/print-unified-editor";

export const PRINT_UNIFIED_EDITOR_SESSION_KEY = "sca_print_unified_v1";

export const PRINT_UNIFIED_EDITOR_SCREEN_ID = "SCREEN-026";

/** Canvas zoom presets (display scale). */
export const PRINT_UNIFIED_ZOOM_LEVELS = [0.5, 0.75, 1] as const;

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

export function nextUnifiedZoom(current: PrintUnifiedZoom, dir: 1 | -1): PrintUnifiedZoom {
  const idx = PRINT_UNIFIED_ZOOM_LEVELS.indexOf(current);
  const next = Math.max(0, Math.min(PRINT_UNIFIED_ZOOM_LEVELS.length - 1, idx + dir));
  return PRINT_UNIFIED_ZOOM_LEVELS[next] ?? current;
}
