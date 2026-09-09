/** UI-only quick-text input hint — must never be stored on canvas layers or exports. */
export const LAYER_QUICK_INPUT_PLACEHOLDER = "텍스트를 입력하세요";

export function stripLayerQuickInputPlaceholder(text: string): string {
  const trimmed = text.replace(/\u200B/g, "").trim();
  if (!trimmed || trimmed === LAYER_QUICK_INPUT_PLACEHOLDER) return "";
  if (
    trimmed.startsWith(LAYER_QUICK_INPUT_PLACEHOLDER) &&
    trimmed.length > LAYER_QUICK_INPUT_PLACEHOLDER.length
  ) {
    return trimmed.slice(LAYER_QUICK_INPUT_PLACEHOLDER.length).trim();
  }
  return text.replace(/\u200B/g, "");
}

export function isLayerQuickInputPlaceholder(text: string): boolean {
  return stripLayerQuickInputPlaceholder(text).length === 0;
}
