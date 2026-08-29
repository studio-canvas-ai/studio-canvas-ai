"use client";

import type { ReactNode } from "react";

export type PrintUnifiedEditorLayoutProps = {
  canvas: ReactNode;
  controls: ReactNode;
  designPanel: ReactNode;
};

/**
 * Screen 26 shell — left canvas (44%) | middle controls (26%) | right design tools (30%).
 * Modern slate surface layering with subtle glass panel borders.
 */
export default function PrintUnifiedEditorLayout({
  canvas,
  controls,
  designPanel,
}: PrintUnifiedEditorLayoutProps) {
  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-transparent">
      <div className="relative mx-auto grid h-full w-full max-w-[1920px] min-h-0 flex-1 grid-cols-1 gap-3 px-3 py-2.5 sm:px-4 sm:py-3 lg:grid-cols-[minmax(0,44fr)_minmax(0,26fr)_minmax(0,30fr)] lg:gap-3 lg:overflow-hidden lg:px-5 lg:pb-4">
        <div className="min-h-[320px] overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/80 shadow-[0_8px_32px_rgba(15,23,42,0.45)] backdrop-blur-sm lg:min-h-0 lg:h-full">
          {canvas}
        </div>
        <div className="relative flex min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/70 shadow-[0_8px_32px_rgba(15,23,42,0.4)] backdrop-blur-md lg:h-full">
          {controls}
        </div>
        <div
          data-unified-design-panel
          className="relative z-[500] flex min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/70 pointer-events-auto shadow-[0_8px_32px_rgba(15,23,42,0.4)] backdrop-blur-md lg:h-full"
        >
          {designPanel}
        </div>
      </div>
    </div>
  );
}
