/**
 * Layer separation policy — AI renders visuals only; copy lives in HTML/CSS/SVG layers.
 * Never burn titles, dates, venues, organizers into Flux pixels.
 */

const BURN_IN_HINT =
  /\b(text|title|subtitle|caption|logo|watermark|typography|lettering|signage|banner text|write|typed|font|headline|날짜|제목|장소|주관|타이틀)\b/i;

/** Appended to every visual Flux prompt (bg + edit). */
export const NO_TEXT_BURN_IN_CLAUSE =
  "Pure visual imagery only — do NOT render any text, letters, numbers, logos, watermarks, captions, titles, dates, or signage in the image pixels.";

export function stripCopyBurnInHints(prompt: string): string {
  return prompt
    .replace(
      /\b(with|including|add|overlay|render|write|put)\s+(the\s+)?(text|title|subtitle|date|location|venue|organizer|caption|headline)[^.]*/gi,
      ""
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Ensure a Flux prompt is visual-only (no typography instructions).
 */
export function applyVisualOnlyPolicy(englishPrompt: string): string {
  const core = stripCopyBurnInHints(englishPrompt.trim());
  if (!core) return NO_TEXT_BURN_IN_CLAUSE;
  if (/no text/i.test(core) && /no watermark/i.test(core)) return core;
  if (BURN_IN_HINT.test(core) || !/no text/i.test(core)) {
    return `${core}. ${NO_TEXT_BURN_IN_CLAUSE}`;
  }
  return core;
}

export function assertNoBurnInIntent(formFields?: Record<string, string> | null): void {
  // Soft guard for logs — form copy must never be concatenated into Fal prompts.
  if (!formFields) return;
  const joined = Object.values(formFields)
    .map((v) => v.trim())
    .filter(Boolean)
    .join(" | ");
  if (joined.length > 0) {
    console.info("[layerPolicy] form copy reserved for overlay layers (not sent to Flux)", {
      preview: joined.slice(0, 80),
    });
  }
}
