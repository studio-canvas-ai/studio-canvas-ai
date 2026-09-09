"use client";

import type { ReactNode } from "react";

export type PrintWizardStep2LayoutProps = {
  preview: ReactNode;
  /** Upper-middle slot — text layers sit here, not inside the right panel. */
  middle?: ReactNode;
  editPanel: ReactNode;
};

/**
 * Step 2 shell — canvas | slimmed text-layer gutter | Template Studio-sized edit panel.
 * The text-layer gutter is intentionally narrower so the canvas can claim the freed width.
 */
export default function PrintWizardStep2Layout({
  preview,
  middle,
  editPanel,
}: PrintWizardStep2LayoutProps) {
  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#0B0F19]">
      <div className="relative mx-auto grid h-full w-full max-w-[1760px] min-h-0 flex-1 grid-cols-1 gap-4 px-3 py-2.5 sm:px-4 sm:py-3 lg:grid-cols-[minmax(0,1.48fr)_minmax(0,0.67fr)_minmax(0,1fr)] lg:gap-6 lg:overflow-hidden lg:px-6 lg:pb-6">
        <div className="min-h-0 lg:h-full lg:overflow-hidden">{preview}</div>
        <div className="relative min-h-0 w-full lg:h-full lg:overflow-y-auto lg:overscroll-contain">
          {middle}
        </div>
        <div
          data-wizard-form
          className="relative z-[500] isolate flex min-h-0 w-full flex-col pointer-events-auto lg:h-full lg:overflow-hidden"
        >
          {editPanel}
        </div>
      </div>
    </div>
  );
}
