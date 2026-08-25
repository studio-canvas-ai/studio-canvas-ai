/**
 * Shared text-layer interaction contract for Screen 7 + Screen 24.
 *
 * Keep the two canvas stacks isolated:
 * - Screen 7 (Template Studio): Konva via StudioKonvaStage + canvasStore
 * - Screen 24 (Print wizard finish): DOM via PreviewTextOverlay
 *
 * Share only pure helpers here (focus, geometry persistence helpers).
 * Do not route Screen 24 pointer math through Konva, or Screen 7 through the DOM overlay.
 */

export const TEXT_LAYER_FIELD_ATTR = "data-layer-id";

export type FocusTextLayerFieldOpts = {
  selectAll?: boolean;
  /** Used when selectAll is false — caret at end if omitted. */
  textLength?: number;
  maxAttempts?: number;
};

/** Focus the side-panel input/textarea for a text layer (Screen 7 list or Screen 24 portal). */
export function focusTextLayerField(
  layerId: string,
  opts?: FocusTextLayerFieldOpts
): void {
  const maxAttempts = opts?.maxAttempts ?? 12;

  const apply = (attempt: number) => {
    const node = document.querySelector(
      `textarea[${TEXT_LAYER_FIELD_ATTR}="${CSS.escape(layerId)}"], input[${TEXT_LAYER_FIELD_ATTR}="${CSS.escape(layerId)}"]`
    ) as HTMLTextAreaElement | HTMLInputElement | null;

    if (!node) {
      if (attempt < maxAttempts) {
        window.setTimeout(() => apply(attempt + 1), 20);
      }
      return;
    }

    node.scrollIntoView({ block: "nearest", behavior: "smooth" });
    node.focus({ preventScroll: true });
    try {
      const len =
        typeof opts?.textLength === "number"
          ? opts.textLength
          : node.value.length;
      if (opts?.selectAll && len > 0) {
        node.setSelectionRange(0, len);
      } else {
        node.setSelectionRange(len, len);
      }
    } catch {
      /* ignore */
    }
  };

  apply(0);
  window.requestAnimationFrame(() => apply(1));
  window.setTimeout(() => apply(2), 40);
  window.setTimeout(() => apply(3), 120);
}

/** Scroll the side-panel field into view without stealing canvas focus. */
export function revealTextLayerField(layerId: string): void {
  const node = document.querySelector(
    `textarea[${TEXT_LAYER_FIELD_ATTR}="${CSS.escape(layerId)}"], input[${TEXT_LAYER_FIELD_ATTR}="${CSS.escape(layerId)}"]`
  ) as HTMLElement | null;
  node?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
