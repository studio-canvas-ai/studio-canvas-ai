/**
 * Universal multi-lingual CommandRouter / IntentRouter.
 *
 * Gemini extracts intent + clean English Flux prompt.
 * On failure: NEVER forward Hangul/CJK source text to Flux.
 */

import { generateGeminiText, getGeminiApiKey, resolveGeminiRouterModel } from "@/lib/gemini";
import {
  CommandParser,
  ensureEnglishFluxPrompt,
  intentToKind,
  isFluxSafeEnglishPrompt,
  newRequestId,
  sanitizeCommandInput,
  type ParsedCommand,
  type RouterError,
  type RouterErrorCode,
} from "@/lib/ai/commandParser";
import {
  coerceIntent,
  GEMINI_INTENT_TOKENS,
} from "@/lib/ai/editIntents";
import {
  applyVisualStyleModifiers,
  buildVisualStyleModifiers,
  normalizeVisualStyleSelection,
  selectedVisualStylePresets,
  type VisualStyleSelection,
} from "@/lib/ai/visualStylePresets";

const GEMINI_SYSTEM = [
  "You are the intent + prompt router for a global photo editing studio.",
  "Users may write in ANY language (Korean, English, Japanese, Chinese, Spanish, French, German, Portuguese, Italian, Russian, Arabic, etc.).",
  "Return ONLY one JSON object (no markdown, no commentary):",
  '{"intent":"GEN_BG|REMOVE_BG|COMPOSITE_BG|EDIT_IMAGE|INPAINTING|UNKNOWN","englishPrompt":"...","language":"en|ko|ja|zh|es|...","summary":"..."}',
  "",
  `Allowed intent tokens: ${GEMINI_INTENT_TOKENS.join(", ")}`,
  "",
  "intent rules:",
  "- REMOVE_BG: remove/cut out background only",
  "- GEN_BG: create/replace scenic empty background from a place/mood keyword",
  "- COMPOSITE_BG: put subject on a new scenic background (cutout + new bg)",
  "- EDIT_IMAGE / INPAINTING: change clothes, hat, hair, style on the person",
  "- UNKNOWN: not an edit command",
  "",
  "englishPrompt rules (CRITICAL):",
  "- ALWAYS write a high-quality English prompt that Flux understands 100%.",
  "- Translate place names accurately (경복궁→Gyeongbokgung Palace Seoul; 제주도→Jeju Island Korea; 長崎→Nagasaki Japan; Playa de Barcelona→Barcelona beach Spain).",
  "- For GEN_BG / COMPOSITE_BG: empty scenic photographic background, no people, no faces, no text, no watermark.",
  "- For EDIT_IMAGE: describe the wardrobe/style change; keep identity and pose.",
  "- englishPrompt MUST be English only — NEVER include Hangul, Japanese kana, or Chinese characters.",
  "- NEVER ask Flux to render titles, dates, venues, organizers, captions, logos, or typography in the image — text is overlaid later as separate layers.",
  "- If styleModifiers is provided in the user JSON, weave those exact visual style & lighting keywords into englishPrompt (do not drop them).",
  "- If the command includes print-piece metadata (format/size, visual style, use, page count, example, field) plus keyword tags, treat ALL clauses as ONE combined scene brief — never ignore format, use, or style because keywords are present.",
  "- For print GEN_BG: photographic empty background that fits that print format and use (calm negative space for later typography overlays). Match keyword tags + chosen style/mood. Still no people, no faces, no letters, no logos.",
  "- Do NOT include previous conversation; this message is the ONLY user input.",
].join("\n");

type GeminiRouterJson = {
  intent?: string;
  englishPrompt?: string;
  language?: string;
  summary?: string;
  prompt?: string;
};

function logRouter(
  level: "info" | "warn" | "error",
  code: RouterErrorCode | "ok",
  detail: Record<string, unknown>
) {
  const payload = { code, ...detail };
  if (level === "error") console.error("[CommandRouter]", payload);
  else if (level === "warn") console.warn("[CommandRouter]", payload);
  else console.info("[CommandRouter]", payload);
}

function makeRouterError(code: RouterErrorCode, message: string): RouterError {
  return { code, message };
}

function extractJsonObject(text: string): GeminiRouterJson | null {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence?.[1]?.trim() || trimmed;
  const match = body.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as GeminiRouterJson;
  } catch {
    try {
      const repaired = match[0]
        .replace(/,\s*}/g, "}")
        .replace(/'/g, '"');
      return JSON.parse(repaired) as GeminiRouterJson;
    } catch {
      return null;
    }
  }
}

function offlineSafeParse(
  raw: string,
  requestId: string,
  cause: RouterError
): ParsedCommand {
  // preferSafeDefault=false → clear error when translation impossible (no Hangul→Flux).
  const parsed = CommandParser(raw, {
    requestId,
    preferSafeDefault: false,
  });
  if (parsed.routerError) {
    // Preserve more specific offline code if present; else attach Gemini cause.
    const merged: RouterError = {
      code: parsed.routerError.code,
      message: `${cause.message} | ${parsed.routerError.message}`,
    };
    logRouter("error", merged.code, {
      requestId,
      cause: cause.code,
      offline: parsed.routerError.code,
      raw: raw.slice(0, 80),
    });
    return { ...parsed, routerError: merged };
  }
  // Offline succeeded via landmark map / Latin / rembg — still surface Gemini cause as warning.
  logRouter("warn", cause.code, {
    requestId,
    note: "Gemini failed; offline safe English path used",
    intent: parsed.intent,
    englishPrompt: parsed.englishPrompt.slice(0, 120),
    raw: raw.slice(0, 80),
  });
  return {
    ...parsed,
    routerError: {
      code: cause.code,
      message: `${cause.message} Offline safe English prompt applied (Hangul blocked from Flux).`,
    },
  };
}

/**
 * CommandRouter — Gemini-first. Never returns Hangul in englishPrompt.
 * Optional visual style selection is bound into Gemini + Flux modifiers.
 */
export type CommandRouterOptions = {
  styleSelection?: VisualStyleSelection | null;
};

export async function CommandRouter(
  command: string,
  options?: CommandRouterOptions
): Promise<ParsedCommand> {
  const requestId = newRequestId();
  const raw = sanitizeCommandInput(command);
  const styleSelection = normalizeVisualStyleSelection(
    options?.styleSelection || null
  );
  const styleModifiers = buildVisualStyleModifiers(styleSelection);
  const styleLabels = selectedVisualStylePresets(styleSelection).map(
    (p) => `${p.labelEn} (${p.id})`
  );

  if (!raw) {
    const empty = CommandParser("", { requestId, preferSafeDefault: false });
    logRouter("error", "empty_command", { requestId });
    return empty;
  }

  if (!getGeminiApiKey()) {
    const err = makeRouterError(
      "gemini_api_key_missing",
      "GEMINI_API_KEY missing on server. Multilingual→English routing disabled."
    );
    logRouter("error", err.code, { requestId, hint: "Set GEMINI_API_KEY in Vercel env" });
    const offline = offlineSafeParse(raw, requestId, err);
    if (!offline.englishPrompt) return offline;
    return {
      ...offline,
      englishPrompt: applyVisualStyleModifiers(
        offline.englishPrompt,
        styleSelection
      ),
    };
  }

  try {
    const userPayload = JSON.stringify({
      requestId,
      command: raw,
      styleSelection: {
        imageStyleId: styleSelection.imageStyleId,
        moodStyleId: styleSelection.moodStyleId,
        labels: styleLabels,
      },
      styleModifiers: styleModifiers || null,
    });

    const routerModel = resolveGeminiRouterModel();
    const { text, model: usedModel } = await generateGeminiText({
      model: routerModel,
      systemInstruction: GEMINI_SYSTEM,
      prompt: userPayload,
      withFallback: true,
    });

    console.info("[CommandRouter]", {
      code: "gemini_response",
      requestId,
      model: usedModel,
      styles: styleLabels,
    });

    const json = extractJsonObject(text);
    if (!json) {
      const err = makeRouterError(
        "gemini_json_parse_failed",
        "Gemini response was not valid JSON."
      );
      logRouter("error", err.code, {
        requestId,
        preview: text.slice(0, 240),
      });
      const offline = offlineSafeParse(raw, requestId, err);
      if (!offline.englishPrompt) return offline;
      return {
        ...offline,
        englishPrompt: applyVisualStyleModifiers(
          offline.englishPrompt,
          styleSelection
        ),
      };
    }

    const intent = coerceIntent(json.intent);
    const summary =
      (typeof json.summary === "string" && json.summary.trim()) ||
      (typeof json.prompt === "string" && json.prompt.trim()) ||
      raw;
    const language =
      typeof json.language === "string" && json.language.trim()
        ? json.language.trim().slice(0, 16)
        : "und";

    const rawEnglish =
      typeof json.englishPrompt === "string" ? json.englishPrompt.trim() : "";
    const englishPrompt = ensureEnglishFluxPrompt(rawEnglish);

    if (!englishPrompt) {
      const code: RouterErrorCode = rawEnglish
        ? "gemini_english_prompt_contaminated"
        : "gemini_empty_english_prompt";
      const err = makeRouterError(
        code,
        rawEnglish
          ? "Gemini englishPrompt contained non-English script (Hangul/CJK) — blocked from Flux."
          : "Gemini returned empty englishPrompt."
      );
      logRouter("error", err.code, {
        requestId,
        contaminatedPreview: rawEnglish.slice(0, 120),
      });
      const offline = offlineSafeParse(raw, requestId, err);
      if (!offline.englishPrompt) return offline;
      return {
        ...offline,
        englishPrompt: applyVisualStyleModifiers(
          offline.englishPrompt,
          styleSelection
        ),
      };
    }

    const styledEnglish = applyVisualStyleModifiers(
      englishPrompt,
      styleSelection
    );

    if (!isFluxSafeEnglishPrompt(styledEnglish)) {
      const err = makeRouterError(
        "gemini_english_prompt_contaminated",
        "englishPrompt failed Flux-safety check — blocked."
      );
      logRouter("error", err.code, { requestId });
      return offlineSafeParse(raw, requestId, err);
    }

    const resolvedIntent =
      intent === "unknown" ? detectIntentHint(raw) : intent;

    const parsed: ParsedCommand = {
      intent: resolvedIntent,
      kind: intentToKind(resolvedIntent),
      englishPrompt: styledEnglish,
      prompt: summary,
      raw,
      language: language === "und" ? guessLanguage(raw) : language,
      confidence: "high",
      requestId,
    };

    logRouter("info", "ok", {
      requestId,
      intent: parsed.intent,
      language: parsed.language,
      styles: styleLabels,
      englishPrompt: parsed.englishPrompt.slice(0, 160),
    });

    return parsed;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const routerErr = makeRouterError(
      "gemini_api_error",
      `Gemini API error: ${errMsg}`
    );
    logRouter("error", routerErr.code, {
      requestId,
      err: errMsg,
    });
    const offline = offlineSafeParse(raw, requestId, routerErr);
    if (!offline.englishPrompt) return offline;
    return {
      ...offline,
      englishPrompt: applyVisualStyleModifiers(
        offline.englishPrompt,
        styleSelection
      ),
    };
  }
}

function detectIntentHint(raw: string): ParsedCommand["intent"] {
  const offline = CommandParser(raw, {
    preferSafeDefault: false,
  });
  return offline.intent === "unknown" ? "generate_bg" : offline.intent;
}

function guessLanguage(raw: string): string {
  if (/[\uAC00-\uD7A3]/.test(raw)) return "ko";
  if (/[\u3040-\u30FF]/.test(raw)) return "ja";
  if (/[\u4E00-\u9FFF]/.test(raw)) return "zh";
  if (/[A-Za-z]/.test(raw)) return "en";
  return "und";
}

/** @deprecated Prefer CommandRouter */
export async function resolveEditIntent(command: string): Promise<ParsedCommand> {
  return CommandRouter(command);
}

export const IntentRouter = CommandRouter;
