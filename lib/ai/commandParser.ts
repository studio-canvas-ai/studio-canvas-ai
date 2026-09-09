/**
 * Conversational AI studio — intents + Flux-safe English helpers.
 * Gemini (CommandRouter) is required for non-English scene prompts.
 * Offline path NEVER forwards Hangul/CJK source text to Flux.
 */

import {
  coerceIntent,
  intentToKind,
  type AiEditIntent,
  type CommandKind,
} from "@/lib/ai/editIntents";

export type { AiEditIntent, CommandKind };
export { coerceIntent, intentToKind };

export type RouterErrorCode =
  | "gemini_api_key_missing"
  | "gemini_api_error"
  | "gemini_json_parse_failed"
  | "gemini_empty_english_prompt"
  | "gemini_english_prompt_contaminated"
  | "offline_translation_unavailable"
  | "empty_command";

export type RouterError = {
  code: RouterErrorCode;
  message: string;
};

export type ParsedCommand = {
  intent: AiEditIntent;
  kind: CommandKind;
  /**
   * Clean English prompt for Flux / Kontext — ONLY this string is sent to Fal.
   * Must pass isFluxSafeEnglishPrompt(); never contains Hangul/CJK source text.
   */
  englishPrompt: string;
  prompt: string;
  raw: string;
  language: string;
  confidence: "high" | "medium" | "low";
  requestId: string;
  /** Set when Gemini routing failed or English prompt is unsafe. */
  routerError?: RouterError;
};

/** Verified English-only studio backdrop — used when scene cannot be translated. */
export const SAFE_DEFAULT_STUDIO_BG =
  "Clean neutral professional photography studio backdrop, soft gray seamless paper, even softbox lighting, empty scene, no people, no faces, no text, no watermark, photorealistic, high detail";

/**
 * Curated landmark → English (offline). Never includes source-script tokens.
 * Used only when Gemini is unavailable so we still avoid Hangul→Flux.
 */
const LANDMARK_EN: Array<[RegExp, string]> = [
  [
    /제주도?\s*유채|유채꽃/i,
    "Jeju Island yellow rapeseed flower field with black volcanic stone walls, bright spring daylight, photorealistic empty scenic background",
  ],
  [
    /경복궁|근정전|gyeongbok/i,
    "Gyeongbokgung Palace in Seoul South Korea, traditional Joseon royal palace with ornate roofs courtyards and stone gates, photorealistic empty scenic background",
  ],
  [
    /창덕궁|changdeok/i,
    "Changdeokgung Palace in Seoul South Korea, traditional Joseon palace architecture and gardens, photorealistic empty scenic background",
  ],
  [
    /두물머리/i,
    "Dumulmeori river confluence Yangpyeong Korea, wide calm river and willows, photorealistic empty scenic background",
  ],
  [
    /남산|namsan/i,
    "Namsan Mountain Seoul with N Seoul Tower, panoramic city views, photorealistic empty scenic background",
  ],
  [
    /제주|jeju/i,
    "Jeju Island Korea turquoise ocean coastline and volcanic scenery, photorealistic empty scenic background",
  ],
  [
    /한강|han\s*river/i,
    "Han River waterfront in Seoul South Korea at golden hour, photorealistic empty scenic background",
  ],
  [
    /북촌|한옥|bukchon|hanok/i,
    "traditional Korean hanok village rooftops and wooden houses, photorealistic empty scenic background",
  ],
  [
    /벚꽃|cherry\s*blossom/i,
    "soft pink cherry blossom avenue in spring, photorealistic empty scenic background",
  ],
  [
    /노을|석양|sunset/i,
    "warm golden hour sunset sky and landscape, photorealistic empty scenic background",
  ],
];

export function newRequestId(): string {
  return `cmd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function sanitizeCommandInput(input: string, maxChars = 2_000): string {
  return input
    .normalize("NFC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxChars);
}

/** True if prompt is safe to send to Flux (Latin-dominant, no Hangul/CJK blocks). */
export function isFluxSafeEnglishPrompt(text: string): boolean {
  const c = text.trim();
  if (c.length < 8) return false;
  // Block Hangul, Hiragana/Katakana, CJK Unified Ideographs.
  if (/[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A3]/.test(c)) return false;
  if (/[\u3040-\u30FF]/.test(c)) return false;
  if (/[\u4E00-\u9FFF]/.test(c)) return false;
  const latin = (c.match(/[A-Za-z]/g) || []).length;
  const letters = (c.match(/\p{L}/gu) || []).length;
  if (letters === 0) return false;
  return latin / letters >= 0.7;
}

/**
 * Accept Gemini English only. Never embed non-English source text into Flux prompts.
 * Returns null when candidate is contaminated / empty → caller must error or safe-default.
 */
export function ensureEnglishFluxPrompt(
  candidate: string,
  _fallbackScene?: string
): string | null {
  const c = candidate.trim();
  if (!c) return null;
  if (!isFluxSafeEnglishPrompt(c)) return null;
  return c;
}

export function lookupLandmarkEnglish(raw: string): string | null {
  for (const [re, en] of LANDMARK_EN) {
    if (re.test(raw)) return en;
  }
  return null;
}

export function isMostlyLatinInput(raw: string): boolean {
  const letters = (raw.match(/\p{L}/gu) || []).length;
  if (letters === 0) return false;
  const latin = (raw.match(/[A-Za-z]/g) || []).length;
  return latin / letters >= 0.7;
}

// ── Offline intent detection (never builds Hangul Flux prompts) ────────────

const REMOVE_BG_RE =
  /(배경\s*(지워|제거|없애)|누끼|배경제거|背景[をを]?消|背景削除|remove\s*(the\s*)?bg|cut\s*out|quitar\s*(el\s*)?fondo|enlever\s*(le\s*)?fond|entferne\s*hintergrund|rimuovi\s*sfondo|remover\s*fundo|удали(ть)?\s*фон|خلفية|背景を消|背景消して)/i;

const COMPOSITE_RE =
  /(합성|올려|얹어|composite|合成|合成して|fusiona|combina|sobreponer|überblende|compos(?:e|er)|наложи)/i;

const GEN_BG_RE =
  /(배경|background|backdrop|風景|背景に|fondo|arrière[-\s]?plan|hintergrund|sfondo|fundo|фон|خلفية|背景にして|배경으로|background\s*(please|now)?)/i;

const EDIT_RE =
  /(옷|양장|정장|한복|모자|헤어|suit|dress|hat|clothes|outfit|服|洋服|着物|ropa|traje|vêtement|kleidung|abito|roupa|одежд)/i;

const INPAINT_RE = /(inpaint|마스크|一部だけ|retoca|retouche|ausbessern)/i;

export function detectOfflineIntent(raw: string): AiEditIntent {
  if (REMOVE_BG_RE.test(raw) && !COMPOSITE_RE.test(raw)) return "remove_bg";
  if (INPAINT_RE.test(raw)) return "inpaint";
  if (
    COMPOSITE_RE.test(raw) ||
    (GEN_BG_RE.test(raw) && /(합성|composite|合成|fusion)/i.test(raw))
  ) {
    return "composite_bg";
  }
  if (EDIT_RE.test(raw) && !GEN_BG_RE.test(raw)) return "edit_image";
  if (GEN_BG_RE.test(raw) || raw.length <= 120) return "generate_bg";
  return "unknown";
}

/**
 * Offline parser: NEVER passes Hangul/CJK user text to Flux.
 * - remove_bg: fixed English rembg instruction
 * - gen/composite: landmark English map OR safe studio default + routerError
 * - edit: requires Latin input or returns error flag via routerError on caller
 */
export function CommandParser(
  input: string,
  opts?: { requestId?: string; preferSafeDefault?: boolean }
): ParsedCommand {
  const requestId = opts?.requestId || newRequestId();
  const raw = sanitizeCommandInput(input);
  const preferSafe = opts?.preferSafeDefault !== false;

  if (!raw) {
    return {
      intent: "unknown",
      kind: "Unknown",
      englishPrompt: "",
      prompt: "",
      raw: "",
      language: "und",
      confidence: "low",
      requestId,
      routerError: {
        code: "empty_command",
        message: "Empty command.",
      },
    };
  }

  const intent = detectOfflineIntent(raw);
  const kind = intentToKind(intent);

  if (intent === "remove_bg") {
    return {
      intent,
      kind,
      englishPrompt:
        "Remove the background; keep the subject with a clean transparent alpha channel.",
      prompt: raw,
      raw,
      language: "und",
      confidence: "medium",
      requestId,
    };
  }

  if (intent === "edit_image" || intent === "inpaint") {
    if (isMostlyLatinInput(raw) && isFluxSafeEnglishPrompt(raw)) {
      return {
        intent,
        kind,
        englishPrompt: `Edit the person in the photo: ${raw}. Keep the same face and identity. Photorealistic.`,
        prompt: raw,
        raw,
        language: "en",
        confidence: "medium",
        requestId,
      };
    }
    return {
      intent: "unknown",
      kind: "Unknown",
      englishPrompt: "",
      prompt: raw,
      raw,
      language: "und",
      confidence: "low",
      requestId,
      routerError: {
        code: "offline_translation_unavailable",
        message:
          "Gemini translation unavailable. Cannot safely edit from non-English text without contaminating Flux. Check GEMINI_API_KEY.",
      },
    };
  }

  if (intent === "generate_bg" || intent === "composite_bg") {
    const landmark = lookupLandmarkEnglish(raw);
    if (landmark) {
      return {
        intent,
        kind,
        englishPrompt: landmark,
        prompt: raw,
        raw,
        language: "und",
        confidence: "medium",
        requestId,
      };
    }
    if (isMostlyLatinInput(raw)) {
      const en = ensureEnglishFluxPrompt(
        `Photorealistic empty photographic background: ${raw}. No people, no faces, no text, no watermark. High detail.`
      );
      if (en) {
        return {
          intent,
          kind,
          englishPrompt: en,
          prompt: raw,
          raw,
          language: "en",
          confidence: "medium",
          requestId,
        };
      }
    }
    // Do NOT forward Hangul to Flux. Error (preferred) or safe studio default.
    if (!preferSafe) {
      return {
        intent: "unknown",
        kind: "Unknown",
        englishPrompt: "",
        prompt: raw,
        raw,
        language: "und",
        confidence: "low",
        requestId,
        routerError: {
          code: "offline_translation_unavailable",
          message:
            "Gemini translation failed/unavailable. Refusing to send non-English text to Flux. Set GEMINI_API_KEY or retry.",
        },
      };
    }
    return {
      intent,
      kind,
      englishPrompt: SAFE_DEFAULT_STUDIO_BG,
      prompt: raw,
      raw,
      language: "und",
      confidence: "low",
      requestId,
      routerError: {
        code: "offline_translation_unavailable",
        message:
          "Gemini unavailable — used safe default studio backdrop instead of raw non-English text (Flux contamination blocked).",
      },
    };
  }

  return {
    intent: "unknown",
    kind: "Unknown",
    englishPrompt: "",
    prompt: raw,
    raw,
    language: "und",
    confidence: "low",
    requestId,
    routerError: {
      code: "offline_translation_unavailable",
      message: "Could not classify command without Gemini.",
    },
  };
}

export const parseCommand = CommandParser;
