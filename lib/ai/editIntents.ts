/**
 * Conversational AI edit intents — enum + Gemini JSON schema tokens.
 */

export type AiEditIntent =
  | "remove_bg"
  | "generate_bg"
  | "composite_bg"
  | "edit_image"
  | "inpaint"
  | "unknown";

export type CommandKind =
  | "RemoveBG"
  | "GenBG"
  | "CompositeBG"
  | "Inpainting"
  | "Unknown";

/** Values returned by Gemini CommandRouter JSON (uppercase tokens). */
export const GEMINI_INTENT_TOKENS = [
  "GEN_BG",
  "REMOVE_BG",
  "COMPOSITE_BG",
  "EDIT_IMAGE",
  "INPAINTING",
  "UNKNOWN",
] as const;

export type GeminiIntentToken = (typeof GEMINI_INTENT_TOKENS)[number];

/** JSON shape Gemini must return (see intentRouter GEMINI_SYSTEM). */
export type GeminiIntentJson = {
  intent: GeminiIntentToken | string;
  englishPrompt: string;
  language?: string;
  summary?: string;
};

export const ALL_EDIT_INTENTS: readonly AiEditIntent[] = [
  "remove_bg",
  "generate_bg",
  "composite_bg",
  "edit_image",
  "inpaint",
  "unknown",
] as const;

export function intentToKind(intent: AiEditIntent): CommandKind {
  switch (intent) {
    case "remove_bg":
      return "RemoveBG";
    case "generate_bg":
      return "GenBG";
    case "composite_bg":
      return "CompositeBG";
    case "edit_image":
    case "inpaint":
      return "Inpainting";
    default:
      return "Unknown";
  }
}

export function coerceIntent(value: unknown): AiEditIntent {
  const s = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  switch (s) {
    case "REMOVE_BG":
    case "REMBG":
    case "CUTOUT":
      return "remove_bg";
    case "GENERATE_BG":
    case "GEN_BG":
    case "BACKGROUND":
    case "T2I":
      return "generate_bg";
    case "COMPOSITE_BG":
    case "COMPOSITE":
    case "SYNTH":
      return "composite_bg";
    case "EDIT_IMAGE":
    case "EDIT":
      return "edit_image";
    case "INPAINT":
    case "INPAINTING":
      return "inpaint";
    case "UNKNOWN":
      return "unknown";
    default: {
      const lower = String(value ?? "").trim().toLowerCase();
      if (
        lower === "remove_bg" ||
        lower === "generate_bg" ||
        lower === "composite_bg" ||
        lower === "edit_image" ||
        lower === "inpaint" ||
        lower === "unknown"
      ) {
        return lower as AiEditIntent;
      }
      return "unknown";
    }
  }
}

export function isEditIntent(value: unknown): value is AiEditIntent {
  return (
    typeof value === "string" &&
    (ALL_EDIT_INTENTS as readonly string[]).includes(value)
  );
}
