/**
 * Contrast / readability helpers for Screen-26 Magic Layout text.
 * Box-local luminance wins over scene hints so dark cards never get dark type.
 */

export type BackgroundTone = "light" | "dark" | "mixed";

const LIGHT_HINTS =
  /창호지|한옥|햇살|햇빛|밝은|밝고|백사장|아이보리|파스텔|크림|종이|벽면|화이트|흰|백색|베이지|살구|연한|맑은|주광|낮|낮빛|shoji|hanok|sunlight|sunny|daylight|bright|light\b|ivory|cream|pastel|beige|paper|whitewall|white\s*wall|sand|linen|soft\s*light|airy|pale|off[\s-]?white|warm\s*white/i;

const DARK_HINTS =
  /밤|야간|어두운|짙은|네온|심야|블랙|먹색|밤하늘|숲속|dark|night|noir|neon|black|deep\s*wood|midnight|dusk|navy|charcoal|shadowy|moody|cinematic\s*dark/i;

/** WCAG relative luminance of #RRGGBB. */
export function hexLuminance(hex: string): number {
  const raw = normalizeHex(hex);
  if (!raw) return 0.5;
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(hexA: string, hexB: string): number {
  const L1 = hexLuminance(hexA);
  const L2 = hexLuminance(hexB);
  const bright = Math.max(L1, L2);
  const dim = Math.min(L1, L2);
  return (bright + 0.05) / (dim + 0.05);
}

export function isLightFillHex(hex: string): boolean {
  return hexLuminance(hex) >= 0.72;
}

export function isDarkFillHex(hex: string): boolean {
  return hexLuminance(hex) <= 0.35;
}

/** Backdrop plate tone — wider bands than glyph fill checks. */
export function backdropToneFromHex(hex: string): BackgroundTone {
  const lum = hexLuminance(hex);
  if (lum <= 0.45) return "dark";
  if (lum >= 0.58) return "light";
  return "mixed";
}

export function inferBackgroundTone(
  ...parts: Array<string | undefined | null>
): BackgroundTone {
  const blob = parts.filter(Boolean).join(" ");
  const light = LIGHT_HINTS.test(blob);
  const dark = DARK_HINTS.test(blob);
  if (light && !dark) return "light";
  if (dark && !light) return "dark";
  if (light && dark) return "mixed";
  return "mixed";
}

export type ParsedFill = { hex: string; opacity: number };

/** Parse #hex or rgba() into solid hex + opacity for luminance. */
export function parseFillColor(fill: string | undefined | null): ParsedFill | null {
  const raw = (fill || "").trim();
  if (!raw) return null;
  const rgba = raw.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i
  );
  if (rgba) {
    const r = Math.round(Number(rgba[1]));
    const g = Math.round(Number(rgba[2]));
    const b = Math.round(Number(rgba[3]));
    const a = rgba[4] != null ? Number(rgba[4]) : 1;
    const hex = `#${[r, g, b]
      .map((c) =>
        Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0")
      )
      .join("")}`;
    return {
      hex,
      opacity: Number.isFinite(a) ? Math.max(0, Math.min(1, a)) : 1,
    };
  }
  const hex = normalizeHex(raw);
  if (!hex) return null;
  return { hex: `#${hex}`, opacity: 1 };
}

function normalizeHex(input: string): string | null {
  const raw = input.replace("#", "").trim();
  if (/^[0-9A-Fa-f]{3}$/.test(raw)) {
    return `${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`.toLowerCase();
  }
  if (/^[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(raw)) {
    return raw.slice(0, 6).toLowerCase();
  }
  return null;
}

function rgbFromHex(hex: string): { r: number; g: number; b: number } {
  const h = normalizeHex(hex) || "808080";
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Light readable defaults on dark cards — tone-matched, still high contrast. */
export function pickLightTextOnDarkBox(backdropHex: string): string {
  const { r, g, b } = rgbFromHex(backdropHex);
  // Warm dark (forest, brown, burgundy) → soft ivory / warm cream
  if (r > g + 15 || (r > 40 && g > 50 && b < g)) {
    return "#F8F1E3";
  }
  // Cool dark (navy, teal) → crisp white / ice
  if (b >= g && b >= r) {
    return "#FFFFFF";
  }
  // Green-dominant dark → soft pastel yellow (readable, on-brand)
  if (g >= r && g >= b) {
    return "#F7E7A1";
  }
  return "#FFFFFF";
}

/** Dark readable defaults on light cards. */
export function pickDarkTextOnLightBox(backdropHex: string): string {
  const { r, g, b } = rgbFromHex(backdropHex);
  if (b > r + 20 && b > g) return "#1B365D"; // cool light → deep navy
  if (r > g + 10 && r > b) return "#2C1810"; // warm light → deep brown
  return "#1A1A1A"; // charcoal / ink
}

const MIN_CONTRAST = 4.5;

/**
 * Force a readable default fill against a backdrop box.
 * Keeps Gemini's fill when contrast already passes; otherwise remaps.
 */
export function ensureTextContrastOnBackdrop(
  textFill: string | undefined,
  backdropHex: string
): string {
  const bgTone = backdropToneFromHex(backdropHex);
  const parsed = parseFillColor(textFill);
  const candidate = parsed?.hex;

  if (candidate && contrastRatio(candidate, backdropHex) >= MIN_CONTRAST) {
    // Still ban dark-on-dark / light-on-light even if ratio barely passes midtones
    if (bgTone === "dark" && isDarkFillHex(candidate)) {
      return pickLightTextOnDarkBox(backdropHex);
    }
    if (bgTone === "light" && isLightFillHex(candidate)) {
      return pickDarkTextOnLightBox(backdropHex);
    }
    return candidate;
  }

  if (bgTone === "dark") return pickLightTextOnDarkBox(backdropHex);
  if (bgTone === "light") return pickDarkTextOnLightBox(backdropHex);

  // Mid backdrop: pick whichever side yields higher contrast
  const light = pickLightTextOnDarkBox(backdropHex);
  const dark = pickDarkTextOnLightBox(backdropHex);
  return contrastRatio(light, backdropHex) >= contrastRatio(dark, backdropHex)
    ? light
    : dark;
}

export type ContrastTextAppearance = {
  /** Preset name or #RRGGBB — independent editable layer color. */
  color: string;
  textShadowColor?: string;
  textShadowBlur?: number;
  textShadowOffsetX?: number;
  textShadowOffsetY?: number;
  textStroke?: string;
  textStrokeWidth?: number;
};

const DEFAULT_LIGHT_SHADOW = {
  textShadowColor: "rgba(0,0,0,0.65)",
  textShadowBlur: 6,
  textShadowOffsetX: 1,
  textShadowOffsetY: 2,
} as const;

/**
 * Map Gemini fill + scene/box tone → readable default color + optional shadow.
 * Local backdrop luminance always wins when present.
 */
export function resolveContrastTextAppearance(opts: {
  fill?: string;
  sceneTone: BackgroundTone;
  /** Local plate/backdrop behind the text, if any. */
  localBackdropHex?: string;
  localBackdropOpacity?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  stroke?: string;
  strokeWidth?: number;
}): ContrastTextAppearance {
  const raw = (opts.fill || "").trim();
  let requestedHex: string | undefined;
  if (raw) {
    requestedHex = parseFillColor(raw)?.hex;
  }

  const backdropUsable =
    Boolean(opts.localBackdropHex) &&
    (opts.localBackdropOpacity == null || opts.localBackdropOpacity >= 0.35);

  let color: string;
  if (backdropUsable && opts.localBackdropHex) {
    color = ensureTextContrastOnBackdrop(requestedHex, opts.localBackdropHex);
  } else {
    // Photo / no solid plate — scene heuristics
    const sceneDefault =
      opts.sceneTone === "light"
        ? "#1A1A1A"
        : opts.sceneTone === "dark"
          ? "#FFFFFF"
          : requestedHex || "#1A1A1A";
    color = requestedHex || sceneDefault;
    if (opts.sceneTone === "light" && isLightFillHex(color)) {
      color = "#1A1A1A";
    } else if (opts.sceneTone === "dark" && isDarkFillHex(color)) {
      color = "#FFFFFF";
    }
  }

  const finalHex = color === "white" ? "#FFFFFF" : color;
  const needsShadow =
    Boolean(opts.shadowColor) ||
    isLightFillHex(finalHex) ||
    (!backdropUsable && opts.sceneTone !== "dark");

  const appearance: ContrastTextAppearance = {
    color: finalHex.toUpperCase() === "#FFFFFF" ? "white" : finalHex,
  };

  if (needsShadow && isLightFillHex(finalHex)) {
    appearance.textShadowColor =
      opts.shadowColor || DEFAULT_LIGHT_SHADOW.textShadowColor;
    appearance.textShadowBlur =
      typeof opts.shadowBlur === "number"
        ? opts.shadowBlur
        : DEFAULT_LIGHT_SHADOW.textShadowBlur;
    appearance.textShadowOffsetX =
      typeof opts.shadowOffsetX === "number"
        ? opts.shadowOffsetX
        : DEFAULT_LIGHT_SHADOW.textShadowOffsetX;
    appearance.textShadowOffsetY =
      typeof opts.shadowOffsetY === "number"
        ? opts.shadowOffsetY
        : DEFAULT_LIGHT_SHADOW.textShadowOffsetY;
  } else if (opts.shadowColor) {
    appearance.textShadowColor = opts.shadowColor;
    appearance.textShadowBlur = opts.shadowBlur ?? 6;
    appearance.textShadowOffsetX = opts.shadowOffsetX ?? 1;
    appearance.textShadowOffsetY = opts.shadowOffsetY ?? 2;
  }

  if (opts.stroke && typeof opts.strokeWidth === "number" && opts.strokeWidth > 0) {
    appearance.textStroke = opts.stroke;
    appearance.textStrokeWidth = opts.strokeWidth;
  } else if (isLightFillHex(finalHex) && !backdropUsable) {
    appearance.textStroke = "rgba(0,0,0,0.35)";
    appearance.textStrokeWidth = 1.25;
  }

  return appearance;
}

/** Runtime draw safety: ensure light fills always get a readable shadow. */
export function resolveDrawTextShadow(opts: {
  fillHex: string;
  textShadowColor?: string;
  textShadowBlur?: number;
  textShadowOffsetX?: number;
  textShadowOffsetY?: number;
}): {
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
} | null {
  if (opts.textShadowColor) {
    return {
      color: opts.textShadowColor,
      blur: opts.textShadowBlur ?? 6,
      offsetX: opts.textShadowOffsetX ?? 1,
      offsetY: opts.textShadowOffsetY ?? 2,
    };
  }
  if (isLightFillHex(opts.fillHex)) {
    return {
      color: DEFAULT_LIGHT_SHADOW.textShadowColor,
      blur: DEFAULT_LIGHT_SHADOW.textShadowBlur,
      offsetX: DEFAULT_LIGHT_SHADOW.textShadowOffsetX,
      offsetY: DEFAULT_LIGHT_SHADOW.textShadowOffsetY,
    };
  }
  return null;
}
