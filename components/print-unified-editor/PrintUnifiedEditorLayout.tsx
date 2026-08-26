"use client";

import type { ReactNode } from "react";

export type PrintUnifiedEditorLayoutProps = {
  canvas: ReactNode;
  controls: ReactNode;
  designPanel: ReactNode;
};

/**
 * Screen 26 shell — left canvas (44%) | middle controls (26%) | right design tools (30%).
 */
export default function PrintUnifiedEditorLayout({
  canvas,
  controls,
  designPanel,
}: PrintUnifiedEditorLayoutProps) {
  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#0B0F19]">
      <div className="relative mx-auto grid h-full w-full max-w-[1920px] min-h-0 flex-1 grid-cols-1 gap-3 px-3 py-2.5 sm:px-4 sm:py-3 lg:grid-cols-[minmax(0,44fr)_minmax(0,26fr)_minmax(0,30fr)] lg:gap-4 lg:overflow-hidden lg:px-5 lg:pb-4">
        <div className="min-h-[320px] lg:min-h-0 lg:h-full lg:overflow-hidden">
          {canvas}
        </div>
        <div className="relative min-h-0 w-full lg:h-full lg:overflow-y-auto lg:overscroll-contain">
          {controls}
        </div>
        <div
          data-unified-design-panel
          className="relative z-[500] flex min-h-0 w-full flex-col pointer-events-auto lg:h-full lg:overflow-hidden"
        >
          {designPanel}
        </div>
      </div>
    </div>
  );
}
