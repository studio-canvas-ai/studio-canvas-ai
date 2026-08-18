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
