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

/** Per-page prompt: shared concept + unique face/purpose. */
export function buildPagePrintAiContext(
  state: PrintWizardState,
  pageIndex: number
): string {
  const base = buildUnifiedPrintAiContext(state);
  if (!base) return "";
  const use = useById(state.useId);
  const face = pageFaceBrief(pageIndex, state.pageCount, use.label);
  const copy = pageCopyHint(state, pageIndex);
  const combined = copy ? `${base}. ${face}. ${copy}` : `${base}. ${face}`;
  return combined.length > 1950
    ? `${combined.slice(0, 1947).trimEnd()}...`
    : combined;
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
