/**
 * Contrast / readability helpers for Screen-26 Magic Layout text.
 * Light backgrounds (shoji, sunlight, ivory…) must not get lone white type.
 */

export type BackgroundTone = "light" | "dark" | "mixed";

const LIGHT_HINTS =
  /창호지|한옥|햇살|햇빛|밝은|밝고|백사장|아이보리|파스텔|크림|종이|벽면|화이트|흰|백색|베이지|살구|연한|맑은|주광|낮|낮빛|shoji|hanok|sunlight|sunny|daylight|bright|light\b|ivory|cream|pastel|beige|paper|whitewall|white\s*wall|sand|linen|soft\s*light|airy|pale|off[\s-]?white|warm\s*white/i;

const DARK_HINTS =
  /밤|야간|어두운|짙은|네온|심야|블랙|먹색|밤하늘|숲속|dark|night|noir|neon|black|deep\s*wood|midnight|dusk|navy|charcoal|shadowy|moody|cinematic\s*dark/i;

export function hexLuminance(hex: string): number {
  const raw = hex.replace("#", "").trim();
  if (raw.length < 6) return 0.5;
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function isLightFillHex(hex: string): boolean {
  return hexLuminance(hex) >= 0.72;
}

export function isDarkFillHex(hex: string): boolean {
  return hexLuminance(hex) <= 0.28;
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

export type ContrastTextAppearance = {
  /** Preset name or #RRGGBB */
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
 * Map Gemini fill + scene tone → readable color + optional shadow/stroke.
 * Light scene + light fill → force deep ink. Light fill anywhere → shadow safety.
 */
export function resolveContrastTextAppearance(opts: {
  fill?: string;
  sceneTone: BackgroundTone;
  /** Local plate/backdrop behind the text, if any. */
  localBackdropHex?: string;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  stroke?: string;
  strokeWidth?: number;
}): ContrastTextAppearance {
  const raw = (opts.fill || "").trim();
  let hex = "#FFFFFF";
  if (/^#[0-9A-Fa-f]{3,8}$/.test(raw)) {
    hex =
      raw.length === 4
        ? `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`
        : raw.slice(0, 7);
  } else if (/^rgba?\(/i.test(raw)) {
    const m = raw.match(
      /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i
    );
    if (m) {
      const r = Math.round(Number(m[1]));
      const g = Math.round(Number(m[2]));
      const b = Math.round(Number(m[3]));
      hex = `#${[r, g, b]
        .map((c) =>
          Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0")
        )
        .join("")}`;
    }
  } else if (!raw) {
    hex = opts.sceneTone === "light" ? "#1A1A1A" : "#FFFFFF";
  }

  const localTone: BackgroundTone | null = opts.localBackdropHex
    ? hexLuminance(opts.localBackdropHex) >= 0.55
      ? "light"
      : hexLuminance(opts.localBackdropHex) <= 0.35
        ? "dark"
        : "mixed"
    : null;

  const effectiveTone = localTone || opts.sceneTone;
  let color = hex;

  // Light backdrop: never leave lone white / near-white type.
  if (effectiveTone === "light" && isLightFillHex(hex)) {
    color = "#1A1A1A";
  }

  // Dark backdrop + dark type → lift to white.
  if (effectiveTone === "dark" && isDarkFillHex(hex)) {
    color = "#FFFFFF";
  }

  const finalHex = color === "white" ? "#FFFFFF" : color;
  const needsShadow =
    Boolean(opts.shadowColor) || isLightFillHex(finalHex);

  const appearance: ContrastTextAppearance = {
    color: color.toUpperCase() === "#FFFFFF" ? "white" : color,
  };

  if (needsShadow) {
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
  }

  if (opts.stroke && typeof opts.strokeWidth === "number" && opts.strokeWidth > 0) {
    appearance.textStroke = opts.stroke;
    appearance.textStrokeWidth = opts.strokeWidth;
  } else if (isLightFillHex(finalHex)) {
    // Thin dark halo for residual light type on complex photos.
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
