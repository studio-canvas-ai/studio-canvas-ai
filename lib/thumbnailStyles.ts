/** Color swatch presets for thumbnail text */
export type ColorPreset =
  | "yellow"
  | "white"
  | "red"
  | "neonLime"
  | "deepBlue"
  | "purplePink"
  | "blackGold"
  | "orange"
  | "skyBlue"
  | "hotPink"
  | "limeGreen"
  | "goldAmber"
  | "tealMint"
  | "inkBlack"
  | "charcoal"
  | "classicNavy"
  | "burgundyWine"
  | "antiqueGold"
  | "deepForest"
  | "dustyRose"
  | "royalPurple"
  | "terracotta"
  | "softIvory"
  | "deepNavy"
  | "deepGold"
  | "crimsonRed"
  | "emeraldGreen"
  | "royalBlue"
  | "deepViolet"
  | "amberDeep"
  | "ceruleanSky"
  | "deepPink"
  | "darkTeal"
  | "slateGray";

export type FontPreset =
  | "pretendard"
  | "variety"
  | "gmarket"
  | "jua"
  | "jalnan"
  | "maple"
  | "tmon"
  | "clean"
  | "vlog"
  | "neon"
  | "impact"
  | "serif"
  | "rounded"
  | "poster"
  | "calligraphy"
  | "classicMyeongjo"
  | "handwriting"
  | "vintageCinema"
  | "slimGothic";
export type TextAlign = "left" | "center" | "right";
export type TextPos = "top" | "center" | "bottom";
export type DepthMode = "front" | "behind";

/** All style chips — Shorts studio + ThumbnailEditor share this DNA. */
export const FONT_PRESET_ORDER: FontPreset[] = [
  "pretendard",
  "variety",
  "gmarket",
  "jua",
  "jalnan",
  "maple",
  "tmon",
  "clean",
  "vlog",
  "neon",
  "impact",
  "serif",
  "rounded",
  "poster",
  "calligraphy",
  "classicMyeongjo",
  "handwriting",
  "vintageCinema",
  "slimGothic",
];

/** Dual-studio AI caption font dropdown (YouTube Shorts–friendly KR faces). */
export const SHORTS_CAPTION_FONT_PRESETS = [
  "pretendard",
  "variety",
  "gmarket",
  "impact",
  "jua",
  "jalnan",
  "maple",
  "tmon",
  "clean",
  "vlog",
  "neon",
  "serif",
  "rounded",
  "poster",
] as const satisfies readonly FontPreset[];

export type ShortsCaptionFontPreset =
  (typeof SHORTS_CAPTION_FONT_PRESETS)[number];

export const STICKER_BADGE_IDS = [
  "HOT",
  "NEW",
  "LIVE",
  "TIP",
  "인기",
  "신규",
  "라이브",
  "꿀팁",
  "추천",
] as const;
export type StickerBadgeId = (typeof STICKER_BADGE_IDS)[number];

export type ColorRange = {
  start: number;
  end: number;
  color: ColorPreset;
};

export type TextLayer = {
  id: string;
  text: string;
  color: ColorPreset;
  fontPreset: FontPreset;
  fontSize: number;
  /** Canvas font weight (300–900). */
  fontWeight?: number;
  align: TextAlign;
  ranges: ColorRange[];
  /** Per-line vertical slot: top / center / bottom (#91) */
  pos: TextPos;
  /** Max 1 accent sticker per line — overlay only, never in textarea (#97–#98) */
  stickerId: StickerBadgeId | null;
  /** Normalized offsets from snap anchor (-0.4 ~ 0.4) */
  offsetX: number;
  offsetY: number;
  /** Extra spacing between characters (px). */
  letterSpacing?: number;
  /** Line height multiplier (e.g. 1.2 = 120%). */
  lineHeight?: number;
  /** Relative max text box width (0.4–1), Shorts-style. */
  maxWidth?: number;
  /** User-resized box size as a fraction of the stage (persists drag/resize). */
  boxW?: number;
  boxH?: number;
  showBox?: boolean;
  showBoxBorder?: boolean;
  boxOpacity?: number;
  /** Background box fill (#RRGGBB). Defaults to black when omitted. */
  boxColor?: string;
  /** User manually placed this layer — keep manualX/Y over auto anchors. */
  layoutLocked?: boolean;
  /** Normalized top-left X (0–1) when layoutLocked. */
  manualX?: number;
  /** Normalized top-left Y (0–1) when layoutLocked. */
  manualY?: number;
};

export const COLOR_PRESETS: Record<
  ColorPreset,
  { fill: string; stroke: string; shadow: string }
> = {
  yellow: { fill: "#FACC15", stroke: "#111111", shadow: "rgba(0,0,0,0.55)" },
  white: { fill: "#FFFFFF", stroke: "transparent", shadow: "rgba(0,0,0,0.65)" },
  red: { fill: "#EF4444", stroke: "#FFFFFF", shadow: "rgba(0,0,0,0.45)" },
  neonLime: { fill: "#A3E635", stroke: "#111111", shadow: "rgba(0,0,0,0.55)" },
  deepBlue: { fill: "#1D4ED8", stroke: "#FFFFFF", shadow: "rgba(0,0,0,0.5)" },
  purplePink: { fill: "#E879F9", stroke: "#7C3AED", shadow: "rgba(124,58,237,0.7)" },
  blackGold: { fill: "#F59E0B", stroke: "#111111", shadow: "rgba(0,0,0,0.6)" },
  orange: { fill: "#FB923C", stroke: "#FFFFFF", shadow: "rgba(0,0,0,0.45)" },
  /** Shorts / YouTube CTR accent colors */
  skyBlue: { fill: "#38BDF8", stroke: "#0F172A", shadow: "rgba(14,165,233,0.45)" },
  hotPink: { fill: "#FF007F", stroke: "#FFFFFF", shadow: "rgba(255,0,127,0.45)" },
  limeGreen: { fill: "#84CC16", stroke: "#111111", shadow: "rgba(132,204,22,0.45)" },
  goldAmber: { fill: "#F59E0B", stroke: "#111111", shadow: "rgba(245,158,11,0.5)" },
  tealMint: { fill: "#14B8A6", stroke: "#0F172A", shadow: "rgba(20,184,166,0.45)" },
  /** Template Studio premium editorial palette */
  inkBlack: { fill: "#000000", stroke: "#FFFFFF", shadow: "rgba(0,0,0,0.55)" },
  charcoal: { fill: "#2C3E50", stroke: "#FFFFFF", shadow: "rgba(0,0,0,0.5)" },
  classicNavy: { fill: "#1B365D", stroke: "#FFFFFF", shadow: "rgba(0,0,0,0.5)" },
  burgundyWine: { fill: "#6A1B29", stroke: "#FFFFFF", shadow: "rgba(0,0,0,0.5)" },
  antiqueGold: { fill: "#8C6D3B", stroke: "#FFFFFF", shadow: "rgba(0,0,0,0.45)" },
  deepForest: { fill: "#1E5631", stroke: "#FFFFFF", shadow: "rgba(0,0,0,0.5)" },
  dustyRose: { fill: "#C98CA8", stroke: "#3F1F2E", shadow: "rgba(0,0,0,0.4)" },
  royalPurple: { fill: "#4A2E75", stroke: "#FFFFFF", shadow: "rgba(0,0,0,0.5)" },
  terracotta: { fill: "#C05A3E", stroke: "#FFFFFF", shadow: "rgba(0,0,0,0.45)" },
  softIvory: { fill: "#F5F5DC", stroke: "#2C2416", shadow: "rgba(0,0,0,0.45)" },
  /** Editorial chips appended after the classic 11-swatch row */
  deepNavy: { fill: "#1E293B", stroke: "#FFFFFF", shadow: "rgba(0,0,0,0.5)" },
  deepGold: { fill: "#B45309", stroke: "#FFFFFF", shadow: "rgba(180,83,9,0.45)" },
  crimsonRed: { fill: "#7F1D1D", stroke: "#FFFFFF", shadow: "rgba(0,0,0,0.5)" },
  emeraldGreen: { fill: "#065F46", stroke: "#FFFFFF", shadow: "rgba(0,0,0,0.5)" },
  royalBlue: { fill: "#1E40AF", stroke: "#FFFFFF", shadow: "rgba(0,0,0,0.5)" },
  deepViolet: { fill: "#581C87", stroke: "#FFFFFF", shadow: "rgba(0,0,0,0.5)" },
  amberDeep: { fill: "#D97706", stroke: "#111111", shadow: "rgba(217,119,6,0.45)" },
  ceruleanSky: { fill: "#0284C7", stroke: "#0F172A", shadow: "rgba(2,132,199,0.45)" },
  deepPink: { fill: "#BE185D", stroke: "#FFFFFF", shadow: "rgba(190,24,93,0.45)" },
  darkTeal: { fill: "#0D9488", stroke: "#0F172A", shadow: "rgba(13,148,136,0.45)" },
  slateGray: { fill: "#475569", stroke: "#FFFFFF", shadow: "rgba(0,0,0,0.5)" },
};

/** Classic thumbnail chips (8) */
export const COLOR_PRESET_ORDER: ColorPreset[] = [
  "yellow",
  "white",
  "red",
  "neonLime",
  "deepBlue",
  "purplePink",
  "blackGold",
  "orange",
];

/**
 * Shorts / Template text color chips — black first, then classic accents,
 * then the 11 editorial hex chips (appended immediately after the original row).
 */
export const EDITORIAL_TEXT_COLOR_ORDER: ColorPreset[] = [
  "deepNavy",
  "deepGold",
  "crimsonRed",
  "emeraldGreen",
  "royalBlue",
  "deepViolet",
  "amberDeep",
  "ceruleanSky",
  "deepPink",
  "darkTeal",
  "slateGray",
];

export const SHORTS_COLOR_PRESET_ORDER: ColorPreset[] = [
  "inkBlack",
  "white",
  "yellow",
  "red",
  "neonLime",
  "deepBlue",
  "purplePink",
  "orange",
  "skyBlue",
  "hotPink",
  "tealMint",
  ...EDITORIAL_TEXT_COLOR_ORDER,
];

/** AI Template Studio — same chip order as Shorts (classic 11 + editorial 11). */
export const TEMPLATE_STUDIO_COLOR_ORDER: ColorPreset[] = [
  ...SHORTS_COLOR_PRESET_ORDER,
];

export const EMOJI_QUICK = [
  "#",
  "@",
  "[",
  "]",
  "★",
  "♪",
  "🔥",
  "⭐",
  "💯",
  "🚨",
  "👉",
  "✨",
  "⚡",
  "💥",
  "👀",
  "🎯",
] as const;

/** Extra symbols/emoji for the “기타” dropdown (char + Korean label). */
export const EMOJI_MORE_CATALOG: ReadonlyArray<{ char: string; label: string }> =
  [
    { char: "←", label: "왼쪽 화살표" },
    { char: "→", label: "오른쪽 화살표" },
    { char: "↑", label: "위 화살표" },
    { char: "↓", label: "아래 화살표" },
    { char: "↔", label: "양방향 화살표" },
    { char: "⇒", label: "이중 화살표" },
    { char: "➤", label: "포인트 화살표" },
    { char: "➜", label: "굵은 화살표" },
    { char: "★", label: "별 (채움)" },
    { char: "☆", label: "별 (빈)" },
    { char: "✦", label: "반짝 별" },
    { char: "✧", label: "얇은 별" },
    { char: "✩", label: "오픈 스타" },
    { char: "✪", label: "원형 별" },
    { char: "✓", label: "체크" },
    { char: "✔", label: "굵은 체크" },
    { char: "✅", label: "초록 체크" },
    { char: "☑", label: "체크박스" },
    { char: "✖", label: "엑스" },
    { char: "❌", label: "빨간 엑스" },
    { char: "♥", label: "하트 (채움)" },
    { char: "♡", label: "하트 (빈)" },
    { char: "❤", label: "빨간 하트" },
    { char: "💕", label: "두 하트" },
    { char: "💖", label: "반짝 하트" },
    { char: "💗", label: "커지는 하트" },
    { char: "●", label: "검은 원" },
    { char: "○", label: "흰 원" },
    { char: "◆", label: "다이아 (채움)" },
    { char: "◇", label: "다이아 (빈)" },
    { char: "■", label: "네모 (채움)" },
    { char: "□", label: "네모 (빈)" },
    { char: "▲", label: "위 삼각" },
    { char: "▼", label: "아래 삼각" },
    { char: "▶", label: "재생" },
    { char: "◀", label: "되감기" },
    { char: "☀", label: "태양" },
    { char: "☁", label: "구름" },
    { char: "⚡", label: "번개" },
    { char: "❄", label: "눈꽃" },
    { char: "🌙", label: "초승달" },
    { char: "🌈", label: "무지개" },
    { char: "🎵", label: "음표" },
    { char: "🎶", label: "음표들" },
    { char: "📷", label: "카메라" },
    { char: "🎬", label: "영화 클래퍼" },
    { char: "📌", label: "핀" },
    { char: "📍", label: "핀 위치" },
    { char: "💡", label: "아이디어" },
    { char: "🔔", label: "알림 벨" },
    { char: "🎉", label: "파티" },
    { char: "🎊", label: "축하" },
    { char: "🏆", label: "트로피" },
    { char: "🎁", label: "선물" },
    { char: "💬", label: "말풍선" },
    { char: "📢", label: "확성기" },
    { char: "❗", label: "느낌표" },
    { char: "❓", label: "물음표" },
    { char: "‼", label: "이중 느낌표" },
    { char: "⁉", label: "느낌+물음" },
    { char: "※", label: "참고 표시" },
    { char: "◎", label: "이중 원" },
    { char: "♠", label: "스페이드" },
    { char: "♣", label: "클로버" },
    { char: "♦", label: "다이아몬드" },
    { char: "♪", label: "여덟분음표" },
    { char: "♫", label: "연결 음표" },
    { char: "☺", label: "미소" },
    { char: "☻", label: "검정 미소" },
    { char: "✨", label: "반짝임" },
    { char: "🌟", label: "빛나는 별" },
    { char: "💫", label: "현기증 별" },
    { char: "🔥", label: "불꽃" },
    { char: "💥", label: "폭발" },
    { char: "👀", label: "눈" },
    { char: "👍", label: "좋아요" },
    { char: "👏", label: "박수" },
    { char: "🙌", label: "만세" },
    { char: "🙏", label: "부탁/감사" },
    { char: "💪", label: "힘" },
    { char: "🤣", label: "빵 터짐" },
    { char: "😍", label: "하트 눈" },
    { char: "🤩", label: "별 눈" },
    { char: "😎", label: "선글라스" },
    { char: "🤝", label: "악수" },
    { char: "👑", label: "왕관" },
    { char: "💎", label: "보석" },
    { char: "🚀", label: "로켓" },
    { char: "⏱", label: "스톱워치" },
    { char: "📅", label: "달력" },
    { char: "💰", label: "돈주머니" },
    { char: "📈", label: "상승 차트" },
    { char: "🔔", label: "종" },
    { char: "🆕", label: "NEW" },
    { char: "🆓", label: "FREE" },
    { char: "🆗", label: "OK" },
  ];

/**
 * Dozens of background-box fill colors (hex). Used by Template / Shorts style panels.
 */
export const TEXT_BOX_BG_COLORS: ReadonlyArray<{ hex: string; label: string }> =
  [
    { hex: "#000000", label: "블랙" },
    { hex: "#111827", label: "잉크" },
    { hex: "#1F2937", label: "차콜" },
    { hex: "#374151", label: "슬레이트" },
    { hex: "#4B5563", label: "그레이" },
    { hex: "#6B7280", label: "미들 그레이" },
    { hex: "#9CA3AF", label: "라이트 그레이" },
    { hex: "#FFFFFF", label: "화이트" },
    { hex: "#FEF3C7", label: "크림" },
    { hex: "#FEF9C3", label: "연노랑" },
    { hex: "#FDE68A", label: "앰버" },
    { hex: "#FACC15", label: "옐로우" },
    { hex: "#F59E0B", label: "골드" },
    { hex: "#D97706", label: "앰버 다크" },
    { hex: "#EA580C", label: "오렌지" },
    { hex: "#F97316", label: "선셋" },
    { hex: "#EF4444", label: "레드" },
    { hex: "#DC2626", label: "크림슨" },
    { hex: "#B91C1C", label: "딥 레드" },
    { hex: "#9F1239", label: "루비" },
    { hex: "#BE123C", label: "로즈" },
    { hex: "#E11D48", label: "핑크 레드" },
    { hex: "#DB2777", label: "핫핑크" },
    { hex: "#EC4899", label: "핑크" },
    { hex: "#F472B6", label: "라이트 핑크" },
    { hex: "#C026D3", label: "푸시아" },
    { hex: "#A855F7", label: "퍼플" },
    { hex: "#7C3AED", label: "바이올렛" },
    { hex: "#6D28D9", label: "딥 퍼플" },
    { hex: "#4C1D95", label: "인디고 퍼플" },
    { hex: "#4338CA", label: "인디고" },
    { hex: "#3730A3", label: "딥 인디고" },
    { hex: "#1D4ED8", label: "블루" },
    { hex: "#2563EB", label: "브라이트 블루" },
    { hex: "#0284C7", label: "스카이" },
    { hex: "#0EA5E9", label: "시안 블루" },
    { hex: "#06B6D4", label: "시안" },
    { hex: "#14B8A6", label: "틸" },
    { hex: "#0D9488", label: "딥 틸" },
    { hex: "#10B981", label: "에메랄드" },
    { hex: "#059669", label: "그린" },
    { hex: "#16A34A", label: "포레스트" },
    { hex: "#15803D", label: "딥 그린" },
    { hex: "#65A30D", label: "라임" },
    { hex: "#84CC16", label: "네온 라임" },
    { hex: "#A3E635", label: "연두" },
    { hex: "#78350F", label: "브라운" },
    { hex: "#92400E", label: "커피" },
    { hex: "#A16207", label: "머스타드" },
    { hex: "#7F1D1D", label: "와인" },
    { hex: "#1E3A5F", label: "네이비" },
    { hex: "#0F172A", label: "미드나잇" },
  ];

/** Multilingual display stacks — covers KR/EN/JA/ZH/ES/FR/DE/IT/VI/HI scripts.
 * Primary face MUST come first so Hangul/Latin pick the style font, not a generic Noto.
 */
const FONT_STACK: Record<FontPreset, string> = {
  pretendard:
    '"Pretendard", "Noto Sans KR", "Noto Sans JP", "Noto Sans SC", "Noto Sans TC", "Noto Sans", system-ui, sans-serif',
  variety:
    '"Black Han Sans", "Noto Sans KR", "Noto Sans JP", "Noto Sans SC", "Noto Sans TC", "Noto Sans Devanagari", "Noto Sans", system-ui, sans-serif',
  gmarket:
    '"Gmarket Sans", "GmarketSans", "Noto Sans KR", "Noto Sans JP", "Noto Sans", system-ui, sans-serif',
  jua: '"Jua", "Juache", "Noto Sans KR", "Noto Sans", system-ui, sans-serif',
  jalnan:
    '"YeogiOttaeJalnan", "Noto Sans KR", "Noto Sans", system-ui, sans-serif',
  maple:
    '"NexonMaplestory", "Noto Sans KR", "Noto Sans", system-ui, sans-serif',
  tmon: '"TmonMonsori", "Tmon", "Noto Sans KR", "Noto Sans", system-ui, sans-serif',
  clean:
    '"Noto Sans KR", "Noto Sans", "Noto Sans JP", "Noto Sans SC", "Noto Sans TC", "Noto Sans Devanagari", system-ui, sans-serif',
  vlog:
    '"Nanum Pen Script", "Noto Sans KR", "Noto Sans JP", "Noto Sans", cursive',
  neon:
    '"Orbitron", "Black Han Sans", "Noto Sans KR", "Noto Sans JP", "Noto Sans", sans-serif',
  impact:
    '"Do Hyeon", "Noto Sans KR", "Noto Sans JP", "Noto Sans SC", "Noto Sans", sans-serif',
  serif:
    '"Noto Serif KR", "Noto Serif JP", "Noto Serif SC", "Noto Serif", "Noto Sans Devanagari", Georgia, serif',
  rounded:
    '"Nunito", "Noto Sans KR", "Noto Sans", "Noto Sans JP", "Noto Sans Devanagari", system-ui, sans-serif',
  poster:
    '"Anton", "Black Han Sans", "Noto Sans KR", "Noto Sans JP", "Noto Sans SC", "Noto Sans", Impact, sans-serif',
  calligraphy:
    '"East Sea Dokdo", "Nanum Brush Script", "Noto Serif KR", "Noto Sans KR", cursive',
  classicMyeongjo:
    '"Song Myung", "Noto Serif KR", "Noto Serif JP", "Noto Serif", Georgia, serif',
  handwriting:
    '"Gaegu", "Nanum Pen Script", "Noto Sans KR", "Noto Sans", cursive',
  vintageCinema:
    '"Limelight", "Black Han Sans", "Do Hyeon", "Noto Sans KR", "Noto Sans", serif',
  slimGothic:
    '"Gothic A1", "Noto Sans KR", "Noto Sans JP", "Noto Sans", system-ui, sans-serif',
};

/** First family in each preset — used for document.fonts.load + canvas weight probes. */
export const FONT_PRESET_PRIMARY: Record<FontPreset, string> = {
  pretendard: "Pretendard",
  variety: "Black Han Sans",
  gmarket: "Gmarket Sans",
  jua: "Jua",
  jalnan: "YeogiOttaeJalnan",
  maple: "NexonMaplestory",
  tmon: "TmonMonsori",
  clean: "Noto Sans KR",
  vlog: "Nanum Pen Script",
  neon: "Orbitron",
  impact: "Do Hyeon",
  serif: "Noto Serif KR",
  rounded: "Nunito",
  poster: "Anton",
  calligraphy: "East Sea Dokdo",
  classicMyeongjo: "Song Myung",
  handwriting: "Gaegu",
  vintageCinema: "Limelight",
  slimGothic: "Gothic A1",
};

/** Families we explicitly wait for before canvas export (no tofu). */
export const SHORTS_WEBFONT_FAMILIES = [
  "Pretendard",
  "Gmarket Sans",
  "GmarketSans",
  "Jua",
  "Juache",
  "YeogiOttaeJalnan",
  "NexonMaplestory",
  "TmonMonsori",
  "Tmon",
  "Black Han Sans",
  "Do Hyeon",
  "Nanum Pen Script",
  "Orbitron",
  "Noto Sans",
  "Noto Sans KR",
  "Noto Sans JP",
  "Noto Sans SC",
  "Noto Sans TC",
  "Noto Sans Devanagari",
  "Noto Serif",
  "Noto Serif KR",
  "Noto Serif JP",
  "Noto Serif SC",
  "Nunito",
  "Anton",
  "East Sea Dokdo",
  "Nanum Brush Script",
  "Song Myung",
  "Gaegu",
  "Limelight",
  "Gothic A1",
] as const;

export function detectScript(
  text: string
): "ko" | "ja" | "zh" | "hi" | "en" {
  if (/[\u3040-\u30ff]/.test(text)) return "ja";
  if (/[\u4e00-\u9fff]/.test(text) && !/[\uac00-\ud7af]/.test(text)) return "zh";
  if (/[\uac00-\ud7af]/.test(text)) return "ko";
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  return "en";
}

/** System color-emoji stack — applied AFTER style fonts so Hangul/Latin keep the preset face. */
export const EMOJI_FONT =
  '"Segoe UI Emoji", "Apple Color Emoji", "Android Emoji", "Noto Color Emoji", "Segoe UI Symbol", sans-serif';

/**
 * CSS / canvas font-family for a preset.
 * Style primary comes first; script fallbacks are AFTER so "variety" ≠ "clean" for Korean.
 */
export function fontForText(preset: FontPreset, text: string): string {
  const primary = FONT_STACK[preset] ?? FONT_STACK.variety;
  const script = detectScript(text);
  if (script === "ja") {
    return `${primary}, "Noto Sans JP", ${EMOJI_FONT}`;
  }
  if (script === "zh") {
    return `${primary}, "Noto Sans SC", "Noto Sans TC", ${EMOJI_FONT}`;
  }
  if (script === "hi") {
    return `${primary}, "Noto Sans Devanagari", ${EMOJI_FONT}`;
  }
  // ko / en / latin — primary stack already includes KR + Latin fallbacks
  return `${primary}, ${EMOJI_FONT}`;
}

/** Canvas-ready font shorthand: `800 48px "Black Han Sans", ...` */
export function canvasFontShorthand(
  preset: FontPreset,
  fontSize: number,
  sampleText = "가A",
  fontWeight = 800
): string {
  const size = Math.max(1, Math.round(fontSize));
  const weight = Math.max(100, Math.min(900, Math.round(fontWeight) || 800));
  return `${weight} ${size}px ${fontForText(preset, sampleText)}`;
}

export function createLayer(partial?: Partial<TextLayer>): TextLayer {
  return {
    id: `layer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text: "",
    color: "yellow",
    fontPreset: "variety",
    fontSize: 48,
    fontWeight: 800,
    align: "center",
    ranges: [],
    pos: "bottom",
    stickerId: null,
    offsetX: 0,
    offsetY: 0,
    letterSpacing: 0,
    lineHeight: 1.2,
    maxWidth: 0.88,
    showBox: false,
    showBoxBorder: false,
    boxOpacity: 0.55,
    boxColor: "#000000",
    ...partial,
  };
}

export function colorAtIndex(layer: TextLayer, index: number): ColorPreset {
  for (const r of layer.ranges) {
    if (index >= r.start && index < r.end) return r.color;
  }
  return layer.color;
}

/** Resolve fill hex for a preset (never throws if a stale key slips in). */
export function colorPresetFill(color: ColorPreset | string | undefined): string {
  if (color && color in COLOR_PRESETS) {
    return COLOR_PRESETS[color as ColorPreset].fill;
  }
  return COLOR_PRESETS.yellow.fill;
}

export function colorPresetMeta(color: ColorPreset | string | undefined) {
  if (color && color in COLOR_PRESETS) {
    return COLOR_PRESETS[color as ColorPreset];
  }
  return COLOR_PRESETS.yellow;
}

/** Dark / near-white chips need a 1px ring to stay visible on the dark panel. */
export function swatchNeedsOutline(color: ColorPreset): boolean {
  const hex = colorPresetFill(color).replace("#", "");
  if (hex.length < 6) return true;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum < 0.22 || lum > 0.9;
}

/** Merge overlapping/adjacent ranges of same color */
export function applyColorRange(
  ranges: ColorRange[],
  start: number,
  end: number,
  color: ColorPreset
): ColorRange[] {
  if (start >= end) return ranges;
  const next: ColorRange[] = [];
  for (const r of ranges) {
    if (r.end <= start || r.start >= end) {
      next.push(r);
      continue;
    }
    if (r.start < start) next.push({ start: r.start, end: start, color: r.color });
    if (r.end > end) next.push({ start: end, end: r.end, color: r.color });
  }
  next.push({ start, end, color });
  return next.sort((a, b) => a.start - b.start);
}

export function isEmojiChar(ch: string): boolean {
  // Prefer Extended_Pictographic so surrogate-pair emoji (🔥 etc.) match as one unit
  try {
    return /\p{Extended_Pictographic}/u.test(ch) || /[\uFE0F\u200D]/u.test(ch);
  } catch {
    return /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/u.test(ch);
  }
}

/** Iterate UTF-16 string by Unicode code point (avoids splitting emoji into `?`). */
export function forEachCodePoint(
  text: string,
  fn: (ch: string, utf16Index: number) => void
): void {
  for (let i = 0; i < text.length; ) {
    const cp = text.codePointAt(i)!;
    const ch = String.fromCodePoint(cp);
    fn(ch, i);
    i += ch.length;
  }
}

export function fontForChar(preset: FontPreset, ch: string): string {
  if (isEmojiChar(ch)) {
    return EMOJI_FONT;
  }
  return fontForText(preset, ch);
}

export type StickerBadgeDef = {
  id: StickerBadgeId;
  label: string;
  emoji?: string;
  fill: string;
  stroke: string;
  glow: string;
  textColor: string;
};

export const STICKER_BADGES: Record<StickerBadgeId, StickerBadgeDef> = {
  HOT: {
    id: "HOT",
    label: "HOT",
    emoji: "🔥",
    fill: "#FF3D00",
    stroke: "#FFD600",
    glow: "rgba(255,61,0,0.85)",
    textColor: "#FFFFFF",
  },
  NEW: {
    id: "NEW",
    label: "NEW",
    fill: "#22C55E",
    stroke: "#A3E635",
    glow: "rgba(34,197,94,0.85)",
    textColor: "#0B1A0F",
  },
  LIVE: {
    id: "LIVE",
    label: "LIVE",
    fill: "#EF4444",
    stroke: "#FCA5A5",
    glow: "rgba(239,68,68,0.9)",
    textColor: "#FFFFFF",
  },
  TIP: {
    id: "TIP",
    label: "TIP",
    emoji: "⚡",
    fill: "#7C3AED",
    stroke: "#E879F9",
    glow: "rgba(124,58,237,0.85)",
    textColor: "#FFFFFF",
  },
  인기: {
    id: "인기",
    label: "인기",
    emoji: "🔥",
    fill: "#FF3D00",
    stroke: "#FFD600",
    glow: "rgba(255,61,0,0.85)",
    textColor: "#FFFFFF",
  },
  신규: {
    id: "신규",
    label: "신규",
    fill: "#22C55E",
    stroke: "#A3E635",
    glow: "rgba(34,197,94,0.85)",
    textColor: "#0B1A0F",
  },
  라이브: {
    id: "라이브",
    label: "라이브",
    fill: "#EF4444",
    stroke: "#FCA5A5",
    glow: "rgba(239,68,68,0.9)",
    textColor: "#FFFFFF",
  },
  꿀팁: {
    id: "꿀팁",
    label: "꿀팁",
    emoji: "⚡",
    fill: "#7C3AED",
    stroke: "#E879F9",
    glow: "rgba(124,58,237,0.85)",
    textColor: "#FFFFFF",
  },
  추천: {
    id: "추천",
    label: "추천",
    emoji: "✨",
    fill: "#0EA5E9",
    stroke: "#7DD3FC",
    glow: "rgba(14,165,233,0.85)",
    textColor: "#FFFFFF",
  },
};

/** @deprecated Use STICKER_BADGES + stickerToken() */
export const STICKER_TEMPLATES = STICKER_BADGE_IDS.map((id) => {
  const b = STICKER_BADGES[id];
  return b.emoji ? `${b.emoji} ${b.label}` : b.label;
}) as readonly string[];

const STICKER_TOKEN_RE = /\[\[(HOT|NEW|LIVE|TIP|인기|신규|라이브|꿀팁|추천)\]\]/g;

/** Strip developer sticker tokens so textarea stays pure user text (#98). */
export function stripStickerTokens(text: string): string {
  return text.replace(STICKER_TOKEN_RE, "").replace(/\s{2,}/g, " ").trimStart();
}

export function stickerToken(id: StickerBadgeId): string {
  return ` [[${id}]] `;
}

export function isStickerToken(segment: string): segment is StickerBadgeId {
  return (STICKER_BADGE_IDS as readonly string[]).includes(segment);
}

export type TextSegment =
  | { kind: "text"; value: string }
  | { kind: "sticker"; id: StickerBadgeId };

export function segmentText(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(STICKER_TOKEN_RE)) {
    const idx = match.index ?? 0;
    if (idx > last) {
      segments.push({ kind: "text", value: text.slice(last, idx) });
    }
    segments.push({ kind: "sticker", id: match[1] as StickerBadgeId });
    last = idx + match[0].length;
  }
  if (last < text.length) {
    segments.push({ kind: "text", value: text.slice(last) });
  }
  return segments.length ? segments : [{ kind: "text", value: text }];
}

/** Draw a single emoji (full code point) with system color-emoji fonts. */
export function drawEmojiChar(
  ctx: CanvasRenderingContext2D,
  ch: string,
  x: number,
  y: number,
  fontSize: number
): number {
  ctx.save();
  ctx.font = `${Math.round(fontSize)}px ${EMOJI_FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "#000";
  // Native fillText preserves color emoji on Win/macOS; offscreen blit often loses color → `?`
  ctx.fillText(ch, x, y);
  const w = ctx.measureText(ch).width || fontSize * 1.1;
  ctx.restore();
  return w;
}

export function measureStickerBadge(
  ctx: CanvasRenderingContext2D,
  id: StickerBadgeId,
  scale = 1
): number {
  const badge = STICKER_BADGES[id];
  const fontSize = Math.round(22 * scale);
  const padX = Math.round(14 * scale);
  ctx.font = `800 ${fontSize}px "Orbitron", "Noto Sans KR", sans-serif`;
  const labelW = ctx.measureText(badge.label).width;
  const emojiW = badge.emoji ? fontSize * 1.1 : 0;
  const gap = badge.emoji ? 4 * scale : 0;
  return labelW + emojiW + gap + padX * 2;
}

export function drawStickerBadge(
  ctx: CanvasRenderingContext2D,
  id: StickerBadgeId,
  x: number,
  y: number,
  scale = 1
): number {
  const badge = STICKER_BADGES[id];
  const fontSize = Math.round(22 * scale);
  const padX = Math.round(14 * scale);
  const padY = Math.round(8 * scale);
  const label = badge.label;
  ctx.save();
  ctx.font = `800 ${fontSize}px "Orbitron", "Noto Sans KR", sans-serif`;
  const labelW = ctx.measureText(label).width;
  const emojiW = badge.emoji ? fontSize * 1.1 : 0;
  const gap = badge.emoji ? 4 * scale : 0;
  const w = labelW + emojiW + gap + padX * 2;
  const h = fontSize + padY * 2;
  const rx = h / 2;
  const top = y - h / 2;

  ctx.shadowColor = badge.glow;
  ctx.shadowBlur = 14 * scale;
  ctx.beginPath();
  ctx.roundRect(x, top, w, h, rx);
  ctx.fillStyle = badge.fill;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2.5 * scale;
  ctx.strokeStyle = badge.stroke;
  ctx.stroke();

  let cx = x + padX;
  const cy = y;
  if (badge.emoji) {
    drawEmojiChar(ctx, badge.emoji, cx, cy, fontSize * 0.95);
    cx += emojiW + gap;
  }
  ctx.fillStyle = badge.textColor;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = `800 ${fontSize}px "Orbitron", "Noto Sans KR", sans-serif`;
  ctx.fillText(label, cx, cy);
  ctx.restore();
  return w;
}

