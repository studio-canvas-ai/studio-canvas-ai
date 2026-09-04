/**
 * Expand / normalize info-list copy into a strict 2-column grid of atomic texts.
 * Labels share one X; values share another X; rows use a fixed Y step.
 */

export type InfoGridTextEl = {
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

export type GridTextSeed = {
  el: InfoGridTextEl;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
  sourceIndex: number;
};

const INFO_LABEL_RE =
  /^(일시|장소|입장|시간|날짜|위치|요금|비용|대상|주최|문의|기간|개장|폐장|주소|연락처|티켓|가격|정원|참가|접수|할인|무료|유료)(?:\s*[:：]|\s+|$)/;

const ROW_GAP_PX = 32;

function parseLabelValue(line: string): { label: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const colon = trimmed.match(/^(.+?)\s*[:：]\s*(.+)$/);
  if (colon) {
    return { label: colon[1]!.trim(), value: colon[2]!.trim() };
  }
  const spaced = trimmed.match(INFO_LABEL_RE);
  if (spaced) {
    const label = spaced[1]!;
    const rest = trimmed.slice(spaced[0].length).trim();
    if (rest) return { label, value: rest };
    return { label, value: "" };
  }
  // "일시 2026.10.15" style
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2 && INFO_LABEL_RE.test(parts[0]!)) {
    return { label: parts[0]!, value: parts.slice(1).join(" ") };
  }
  return null;
}

function looksLikeInfoBlob(text: string): boolean {
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return false;
  let hits = 0;
  for (const line of lines) {
    if (parseLabelValue(line) || INFO_LABEL_RE.test(line)) hits += 1;
  }
  return hits >= 2;
}

function cloneEl(
  base: InfoGridTextEl,
  patch: Partial<InfoGridTextEl>
): InfoGridTextEl {
  return { ...base, ...patch, backgroundFill: undefined, backgroundOpacity: undefined };
}

/**
 * Split multiline "일시/장소/입장" blobs into label + value atomic texts
 * on a shared 2-column grid (fixed labelX / valueX, ROW_GAP_PX step).
 */
export function expandInfoGridSeeds(
  seeds: GridTextSeed[],
  stageW: number
): GridTextSeed[] {
  const out: GridTextSeed[] = [];
  let synthetic = 0;

  for (const seed of seeds) {
    const raw = String(seed.el.text || "");
    if (!looksLikeInfoBlob(raw)) {
      out.push(seed);
      continue;
    }

    const lines = raw
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const rows = lines
      .map(parseLabelValue)
      .filter((r): r is { label: string; value: string } => Boolean(r));

    if (rows.length < 2) {
      out.push(seed);
      continue;
    }

    // Guard against fractional-width seeds that survived as ~0–2px.
    const blockW = Math.max(seed.w, stageW * 0.55);
    const blockX =
      seed.w < stageW * 0.2
        ? Math.max(0, (stageW - blockW) / 2)
        : seed.x;
    const pad = Math.max(12, blockW * 0.06);
    const labelColW = Math.min(Math.max(88, blockW * 0.22), 160);
    const gap = Math.max(16, blockW * 0.04);
    const labelX = blockX + pad;
    const valueX = labelX + labelColW + gap;
    const valueW = Math.max(stageW * 0.3, blockX + blockW - pad - valueX);
    const fontSize = Math.max(28, seed.fontSize);
    const rowH = Math.max(fontSize * 1.35, ROW_GAP_PX * 0.85);
    const startY =
      seed.y + Math.max(8, (seed.h - rows.length * ROW_GAP_PX) / 2);

    rows.forEach((row, i) => {
      const y = startY + i * ROW_GAP_PX;
      const fs = fontSize;
      out.push({
        el: cloneEl(seed.el, {
          id: seed.el.id
            ? `${seed.el.id}-label-${i}`
            : `info-label-${synthetic++}`,
          text: row.label,
          align: "left",
          fontWeight: 700,
          width: labelColW,
          height: rowH,
          fontSize: fs,
        }),
        x: Math.max(0, Math.min(labelX, stageW - labelColW)),
        y,
        w: labelColW,
        h: rowH,
        fontSize: fs,
        sourceIndex: seed.sourceIndex,
      });
      if (row.value) {
        out.push({
          el: cloneEl(seed.el, {
            id: seed.el.id
              ? `${seed.el.id}-value-${i}`
              : `info-value-${synthetic++}`,
            text: row.value,
            align: "left",
            fontWeight: 500,
            width: valueW,
            height: rowH,
            fontSize: fs,
          }),
          x: Math.max(0, Math.min(valueX, stageW - valueW)),
          y,
          w: valueW,
          h: rowH,
          fontSize: fs,
          sourceIndex: seed.sourceIndex,
        });
      }
    });
  }

  return snapLooseInfoColumns(out, stageW);
}

/**
 * When Gemini already emitted separate label/value atoms but X/Y wobble,
 * snap labels to one X and values to one X, and even out row Y.
 */
function snapLooseInfoColumns(
  seeds: GridTextSeed[],
  stageW: number
): GridTextSeed[] {
  const labelIdx: number[] = [];
  const valueIdx: number[] = [];

  seeds.forEach((seed, i) => {
    const t = String(seed.el.text || "").trim();
    if (!t) return;
    if (t.length <= 6 && INFO_LABEL_RE.test(t)) {
      labelIdx.push(i);
      return;
    }
    // Value candidates: longer copy near labels (same rough band)
    if (t.length > 2 && !INFO_LABEL_RE.test(t)) {
      valueIdx.push(i);
    }
  });

  if (labelIdx.length < 2) return seeds;

  const labels = labelIdx.map((i) => seeds[i]!);
  const labelX = median(labels.map((s) => s.x));
  const labelW = Math.max(
    64,
    median(labels.map((s) => s.w)),
    ...labels.map((s) => s.w)
  );
  // Pair each label with nearest value to the right
  const usedValues = new Set<number>();
  const pairs: Array<{ li: number; vi: number | null; y: number }> = [];

  for (const li of labelIdx) {
    const lab = seeds[li]!;
    let bestVi: number | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const vi of valueIdx) {
      if (usedValues.has(vi)) continue;
      const val = seeds[vi]!;
      const dy = Math.abs(val.y - lab.y);
      const dx = val.x - lab.x;
      if (dx < -8 || dy > ROW_GAP_PX * 0.85) continue;
      const dist = dy * 3 + Math.abs(dx);
      if (dist < bestDist) {
        bestDist = dist;
        bestVi = vi;
      }
    }
    if (bestVi != null) usedValues.add(bestVi);
    pairs.push({ li, vi: bestVi, y: lab.y });
  }

  if (pairs.filter((p) => p.vi != null).length < 2) return seeds;

  pairs.sort((a, b) => a.y - b.y);
  const valueXs = pairs
    .map((p) => (p.vi != null ? seeds[p.vi]!.x : null))
    .filter((x): x is number => x != null);
  const valueX = median(valueXs.length ? valueXs : [labelX + labelW + 16]);
  const topY = pairs[0]!.y;

  const next = seeds.map((s) => ({ ...s, el: { ...s.el } }));
  pairs.forEach((p, row) => {
    const y = topY + row * ROW_GAP_PX;
    const lab = next[p.li]!;
    lab.x = clamp(labelX, 0, stageW - 8);
    lab.y = y;
    lab.w = Math.min(labelW, stageW - lab.x);
    lab.el.align = "left";
    if (p.vi != null) {
      const val = next[p.vi]!;
      val.x = clamp(valueX, 0, stageW - 8);
      val.y = y;
      val.w = Math.max(48, Math.min(val.w, stageW - val.x));
      val.el.align = "left";
    }
  });

  return next;
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export { ROW_GAP_PX, INFO_LABEL_RE, parseLabelValue };
