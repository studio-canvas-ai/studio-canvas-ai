"use client";

import type { ReactNode } from "react";

export type PrintUnifiedEditorLayoutProps = {
  canvas: ReactNode;
  controls: ReactNode;
  designPanel: ReactNode;
};

/**
 * Screen 26 shell — left canvas (44%) | middle controls (26%) | right design tools (30%).
 * Mobile: canvas (fixed) → compact mini thumbs → scrollable edit tools (always visible).
 */
export default function PrintUnifiedEditorLayout({
  canvas,
  controls,
  designPanel,
}: PrintUnifiedEditorLayoutProps) {
  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-transparent">
      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-[1920px] flex-1 flex-col gap-2 overflow-hidden px-3 py-2.5 sm:px-4 sm:py-3 lg:grid lg:grid-cols-[minmax(0,44fr)_minmax(0,26fr)_minmax(0,30fr)] lg:gap-3 lg:overflow-hidden lg:px-5 lg:pb-4">
        <div className="h-[34vh] max-h-[38vh] min-h-[200px] shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm lg:h-full lg:max-h-none lg:min-h-[320px]">
          {canvas}
        </div>

        <div className="relative flex shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:h-full lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain">
          {controls}
        </div>

        <div
          id="unified-style-panel"
          data-unified-design-panel
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:h-full"
        >
          <div className="flex shrink-0 items-center border-b border-slate-200 px-3 py-2 lg:hidden">
            <p className="text-sm font-bold text-slate-900">
              AI 배경 · 스타일 · 데코 · 폰트
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] lg:flex lg:h-full lg:flex-col lg:overflow-hidden">
            {designPanel}
          </div>
        </div>
      </div>
    </div>
  );
}
