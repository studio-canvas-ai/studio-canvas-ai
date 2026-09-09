"use client";

import { useEffect, useState } from "react";

export type VisualViewportFrame = {
  /** CSS `top` for a position:fixed shell (iOS keyboard offset). */
  offsetTop: number;
  /** Visible viewport height in CSS px. */
  height: number;
  /** Layout viewport height — stable while soft keyboard is open. */
  layoutHeight: number;
  /** Soft keyboard likely open (visual viewport much shorter than layout). */
  keyboardOpen: boolean;
};

const KEYBOARD_GAP_PX = 120;

function readFrame(): VisualViewportFrame {
  if (typeof window === "undefined") {
    return {
      offsetTop: 0,
      height: 0,
      layoutHeight: 0,
      keyboardOpen: false,
    };
  }
  const vv = window.visualViewport;
  const layoutHeight = window.innerHeight || 0;
  const height = vv?.height ?? layoutHeight;
  const offsetTop = vv?.offsetTop ?? 0;
  const keyboardOpen =
    layoutHeight > 0 && layoutHeight - height > KEYBOARD_GAP_PX;
  return { offsetTop, height, layoutHeight, keyboardOpen };
}

/**
 * Tracks `visualViewport` so fixed mobile shells stay locked to the visible
 * area when the soft keyboard opens (instead of 100dvh being pushed away).
 */
export function useVisualViewportFrame(enabled: boolean): VisualViewportFrame {
  const [frame, setFrame] = useState<VisualViewportFrame>(() =>
    enabled ? readFrame() : readFrame()
  );

  useEffect(() => {
    if (!enabled) return;

    let raf = 0;
    const sync = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setFrame(readFrame());
      });
    };

    sync();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);

    return () => {
      cancelAnimationFrame(raf);
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, [enabled]);

  return frame;
}

/** Dual-preview band height on mobile — uses layout height so keyboard does not collapse it. */
export function mobileDualPreviewHeightPx(frame: VisualViewportFrame): number {
  const layout =
    frame.layoutHeight > 0
      ? frame.layoutHeight
      : frame.height > 0
        ? frame.height
        : 700;
  const ideal = Math.round(layout * 0.42);
  if (!frame.keyboardOpen || frame.height <= 0) {
    return Math.max(200, Math.min(ideal, Math.round(layout * 0.45)));
  }
  // Keep preview visible; leave room for the focused text field below.
  const capped = Math.round(frame.height * 0.34);
  return Math.max(148, Math.min(ideal, capped));
}
