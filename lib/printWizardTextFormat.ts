/**
 * Print wizard text normalization — plain typography (no digit badges) and
 * fixed-column program lists.
 */

export type ProgramEntry = {
  num: number;
  label: string;
};

const PROGRAM_SPLIT =
  /(\d+)\s*[.,)、\-–—]+\s*([^0-9]+?)(?=\s+\d+\s*[.,)、\-–—]|$)/g;

/** Parse numbered program lines from free-form smart-form input. */
export function parseProgramEntries(raw: string): ProgramEntry[] {
  const text = raw.trim();
  if (!text) return [];

  const entries: ProgramEntry[] = [];
  const inline = text.replace(/\s+/g, " ");
  let match: RegExpExecArray | null;
  PROGRAM_SPLIT.lastIndex = 0;
  while ((match = PROGRAM_SPLIT.exec(inline)) !== null) {
    const label = match[2]
      .trim()
      .replace(/^[.,)\s]+|[.,)\s]+$/g, "");
    if (label) entries.push({ num: Number(match[1]), label });
  }

  if (!entries.length) {
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const row = trimmed.match(/^(\d+)\s*[.,)、\-–—]*\s*(.+)$/);
      if (row) {
        entries.push({
          num: Number(row[1]),
          label: row[2].trim().replace(/^[.,)\s]+|[.,)\s]+$/g, ""),
        });
      }
    }
  }

  return entries.sort((a, b) => a.num - b.num);
}

/** Format programs as newline list with padded number column. */
export function formatProgramsList(raw: string): string {
  const entries = parseProgramEntries(raw);
  if (!entries.length) return raw.trim();
  const numWidth = Math.max(...entries.map((e) => String(e.num).length));
  return entries
    .map((e) => `${String(e.num).padStart(numWidth)}. ${e.label}`)
    .join("\n");
}

/** Collapse spaced digit dates (e.g. "2 0 2 6 - 0 8 - 2 9") to plain text. */
export function normalizeDateText(raw: string): string {
  const text = raw.trim();
  if (!text) return text;
  if (!/\d\s+\d/.test(text)) return text;

  const compact = text.replace(/\s+/g, "");
  const digits = compact.replace(/\D/g, "");
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  if (digits.length === 6) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`;
  }
  return compact;
}

/**
 * Strip keycap / enclosed digit “badge” glyphs so layer-list inputs show
 * plain ASCII numbers (Screen 7 / 24 list UI).
 * - Keycaps: 1️⃣ (digit + VS16 + combining keycap)
 * - Circled / parenthesized digits (① ⑴ …)
 * - Fullwidth digits ０–９
 */
export function toPlainLayerListText(raw: string): string {
  if (!raw) return raw;
  let text = raw
    // Keycap sequences: "1" + optional FE0F + 20E3 → "1"
    .replace(/([0-9])\uFE0F?\u20E3/g, "$1")
    // Variation selectors left after keycap strip
    .replace(/\uFE0F/g, "");

  // Enclosed alphanumerics → ASCII digits
  text = text.replace(/[\u2460-\u2468]/g, (ch) =>
    String(ch.charCodeAt(0) - 0x2460 + 1)
  );
  text = text.replace(/\u24EA/g, "0"); // ⓪
  text = text.replace(/[\u2474-\u247C]/g, (ch) =>
    String(ch.charCodeAt(0) - 0x2474 + 1)
  ); // ⑴–⑼
  text = text.replace(/[\u2488-\u2490]/g, (ch) =>
    String(ch.charCodeAt(0) - 0x2488 + 1)
  ); // ⒈–⒐
  // Fullwidth digits
  text = text.replace(/[\uFF10-\uFF19]/g, (ch) =>
    String(ch.charCodeAt(0) - 0xff10)
  );

  return text;
}

export function formatFormFieldText(
  field: string,
  text: string
): string {
  const plain = toPlainLayerListText(text);
  if (field === "programs") return formatProgramsList(plain);
  if (field === "date") return normalizeDateText(plain);
  return plain;
}

export function formFieldFromLayerId(id: string): string | null {
  if (!id.startsWith("form-")) return null;
  return id.slice(5);
}

/** Monospace stack for program list number column (equal digit widths). */
export const PROGRAM_NUM_MONO_FONT =
  'ui-monospace, SFMono-Regular, "Cascadia Mono", Menlo, Monaco, Consolas, "Liberation Mono", monospace';

export function programNumFontCss(fontWeight: number, fontSize: number): string {
  return `${fontWeight} ${fontSize}px ${PROGRAM_NUM_MONO_FONT}`;
}

/** Widest number label for column sizing (e.g. "99."). */
export function widestProgramNumSample(entries: ProgramEntry[]): string {
  if (!entries.length) return "9.";
  const digits = Math.max(...entries.map((e) => String(e.num).length));
  return `${"9".repeat(digits)}.`;
}

export function measureProgramNumberColumnWidth(
  ctx: CanvasRenderingContext2D,
  entries: ProgramEntry[],
  fontSize: number,
  fontWeight: number
): number {
  if (!entries.length) return fontSize * 1.8;
  ctx.font = programNumFontCss(fontWeight, fontSize);
  return ctx.measureText(widestProgramNumSample(entries)).width;
}

/** Fixed width for the number column in program lists (px). */
export function programNumberColumnWidth(
  entries: ProgramEntry[],
  fontSize: number,
  fontWeight = 700,
  ctx?: CanvasRenderingContext2D | null
): number {
  if (ctx) return measureProgramNumberColumnWidth(ctx, entries, fontSize, fontWeight);
  if (!entries.length) return fontSize * 1.8;
  const digits = Math.max(...entries.map((e) => String(e.num).length));
  return fontSize * (digits * 0.62 + 0.55);
}

export function measureProgramListWidth(
  ctx: CanvasRenderingContext2D,
  entries: ProgramEntry[],
  fontSize: number,
  fontWeight: number,
  labelFontFamily: string
): number {
  const numColW = measureProgramNumberColumnWidth(
    ctx,
    entries,
    fontSize,
    fontWeight
  );
  const gap = fontSize * 0.35;
  ctx.font = `${fontWeight} ${fontSize}px ${labelFontFamily}`;
  let maxRow = 0;
  for (const entry of entries) {
    const labelW = ctx.measureText(entry.label).width;
    maxRow = Math.max(maxRow, numColW + gap + labelW);
  }
  return maxRow;
}
