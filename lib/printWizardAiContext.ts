/**
 * Unify print-wizard options + user keywords into one AI prompt context.
 */

import { fieldById, formatById, useById } from "@/lib/printWizardTypes";
import { SMART_PROMPT_PRESETS } from "@/lib/printWizardPromptPresets";
import { resolveVisualStylePreset } from "@/lib/ai/visualStylePresets";
import type { PrintWizardState } from "@/lib/printWizardTypes";

export function pageCountLabel(pageCount: number): string {
  if (pageCount === 1) return "단면 1면";
  if (pageCount === 2) return "양면 2면";
  return `${pageCount}면`;
}

/**
 * Screen 8 — dedicated back-cover prompt when 장수 = 양면(2면).
 * `{topic_keywords}` is replaced with the user's theme / keyword tags.
 */
export const DOUBLE_SIDED_BACK_COVER_PROMPT_TEMPLATE =
  "A professional double-sided print back cover background sharing the exact same theme and image composition as the front page: {topic_keywords}. The layout is divided into two distinct zones: The outer borders and frame remain rich and vivid, maintaining about 80% of the front page's depth and color intensity. The central rectangular text area features the exact same image content, but rendered in a very subtle, faint, low-opacity, and softly washed style so that text can be easily overlaid with high readability. High-end editorial design, professional layout, 8k resolution, masterpiece.";

/** Theme keywords shared across front/back of a double-sided print. */
export function topicKeywordsFromState(state: PrintWizardState): string {
  const keywords = state.bgKeyword.trim();
  if (keywords) return keywords;

  const field = fieldById(state.bgPresetId);
  if (field?.keyword?.trim()) return field.keyword.trim();

  const example = SMART_PROMPT_PRESETS.find(
    (p) => p.id === state.selectedPromptPresetId
  );
  const intent = (example?.prompt || state.mainPrompt).trim();
  if (intent) {
    return intent.length > 220
      ? `${intent.slice(0, 217).trimEnd()}...`
      : intent;
  }

  return "elegant print design";
}

export function buildDoubleSidedBackCoverPrompt(
  topicKeywords: string
): string {
  const topic = topicKeywords.trim() || "elegant print design";
  return DOUBLE_SIDED_BACK_COVER_PROMPT_TEMPLATE.replace(
    "{topic_keywords}",
    topic
  );
}

/** Front / inner / back framing so each page gets a distinct composition. */
export function pageFaceBrief(
  pageIndex: number,
  pageCount: number,
  useLabel: string
): string {
  const n = pageIndex + 1;
  const total = Math.max(1, pageCount);
  const piece = useLabel.trim() || "print piece";
  if (total === 1) {
    return `single-sided ${piece}, page 1 of 1, complete one-page composition with calm negative space for typography`;
  }
  if (n === 1) {
    return `FRONT of a ${total}-page ${piece} (page 1 of ${total}): hero establishing shot of the same theme, inviting composition, extra open space in the upper third for a headline — unique to the cover, never reused on later pages`;
  }
  if (total === 2 && n === 2) {
    return `BACK COVER of a double-sided ${piece}: same composition as the front, vivid outer borders (~80% intensity), faint washed central text area — not a copy of page 1`;
  }
  if (n === total) {
    return `BACK/closing of a ${total}-page ${piece} (page ${n} of ${total}): same world and color palette as the front but a clearly different camera angle, depth, and layout — complementary reverse side, never a duplicate of page 1`;
  }
  return `INNER page ${n} of ${total} for a ${piece}: continuation of the same theme with a distinct mid-story framing and different focal objects — not a copy of the cover`;
}

function pageCopyHint(state: PrintWizardState, pageIndex: number): string {
  const layers = state.textLayersByPage?.[pageIndex] ?? [];
  const texts = layers
    .map((layer) => layer.text.trim())
    .filter(Boolean)
    .slice(0, 4);
  if (!texts.length) return "";
  return `this page carries overlay copy (do not render any letters): ${texts.join(" / ")}`;
}

function truncatePrompt(prompt: string, max = 1950): string {
  if (prompt.length <= max) return prompt;
  return `${prompt.slice(0, max - 3).trimEnd()}...`;
}

/** Per-page prompt: shared concept + unique face/purpose. */
export function buildPagePrintAiContext(
  state: PrintWizardState,
  pageIndex: number
): string {
  // 양면(2면) 뒷면 — same composition as front, vivid borders, washed center.
  if (state.pageCount === 2 && pageIndex === 1) {
    const back = buildDoubleSidedBackCoverPrompt(
      topicKeywordsFromState(state)
    );
    const copy = pageCopyHint(state, pageIndex);
    const format = formatById(state.formatId);
    const use = useById(state.useId);
    const formatLabel =
      state.formatId === "free" && state.customSize
        ? `${state.customSize.width}×${state.customSize.height}${state.customSize.unit}`
        : format.label;
    const meta = `print piece: ${formatLabel}, ${use.label}, ${pageCountLabel(2)}. print-ready photographic background only, no text, no letters, no watermark, no logos`;
    const combined = copy
      ? `${back}. ${meta}. ${copy}`
      : `${back}. ${meta}`;
    return truncatePrompt(combined);
  }

  const base = buildUnifiedPrintAiContext(state);
  if (!base) return "";
  const use = useById(state.useId);
  const face = pageFaceBrief(pageIndex, state.pageCount, use.label);
  const copy = pageCopyHint(state, pageIndex);
  const combined = copy ? `${base}. ${face}. ${copy}` : `${base}. ${face}`;
  return truncatePrompt(combined);
}

/** Single organic context string for Flux / layout — options + tags together. */
export function buildUnifiedPrintAiContext(state: PrintWizardState): string {
  const format = formatById(state.formatId);
  const use = useById(state.useId);
  const formatLabel =
    state.formatId === "free" && state.customSize
      ? `${state.customSize.width}×${state.customSize.height}${state.customSize.unit}`
      : format.label;
  const field = fieldById(state.bgPresetId);
  const example = SMART_PROMPT_PRESETS.find(
    (p) => p.id === state.selectedPromptPresetId
  );
  const imageStyle = resolveVisualStylePreset(state.visualStyle.imageStyleId);
  const moodStyle = resolveVisualStylePreset(state.visualStyle.moodStyleId);

  const keywords = state.bgKeyword.trim();
  const meta: string[] = [];

  meta.push(
    `print piece: ${formatLabel}, ${use.label}, ${pageCountLabel(state.pageCount)}`
  );

  if (field) {
    meta.push(`field: ${field.label}`);
  }

  if (imageStyle) {
    meta.push(`visual style: ${imageStyle.labelEn}`);
  }
  if (moodStyle) {
    meta.push(`mood: ${moodStyle.labelEn}`);
  }

  if (example?.prompt) {
    meta.push(`design intent: ${example.prompt}`);
  } else if (state.mainPrompt.trim()) {
    meta.push(`design intent: ${state.mainPrompt.trim()}`);
  }

  const scene =
    keywords ||
    (field?.keyword ? field.keyword : "") ||
    "print-ready scenic background";

  const suffix =
    "print-ready photographic background only, leave calm negative space for later typography overlays, no text, no letters, no watermark, no logos";

  const metaBlock = meta.join(". ");
  const budget = 1800 - metaBlock.length - suffix.length - 4;
  const sceneBlock =
    budget > 40 && scene.length > budget
      ? `${scene.slice(0, Math.max(0, budget - 3)).trimEnd()}...`
      : scene;

  return `${sceneBlock}. ${metaBlock}. ${suffix}`;
}
