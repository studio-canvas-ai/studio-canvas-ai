"use client";

import type { ReactNode } from "react";

export type Step2LayoutProps = {
  preview: ReactNode;
  specs: ReactNode;
  form: ReactNode;
  /** Kept for API compatibility; page chrome title lives in the preview panel. */
  title?: string;
  subtitle?: string;
};

/**
 * Stable 3-column dark studio shell: preview | specs | form.
 * Parent already clears the fixed navbar; this fills remaining viewport height.
 */
export default function Step2Layout({
  preview,
  specs,
  form,
}: Step2LayoutProps) {
  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#0B0F19]">
      <div className="relative mx-auto grid h-full w-full max-w-[1760px] min-h-0 flex-1 grid-cols-1 gap-3 px-3 py-2.5 sm:gap-3.5 sm:px-4 sm:py-3 lg:grid-cols-[minmax(0,4.6fr)_minmax(0,2.7fr)_minmax(0,2.7fr)] lg:overflow-hidden lg:pb-3">
        <div className="min-h-0 lg:h-full lg:overflow-hidden">{preview}</div>
        <div className="relative min-h-0 lg:h-full lg:overflow-hidden">
          {specs}
        </div>
        <div
          data-wizard-form
          className="relative z-[500] isolate min-h-0 pointer-events-auto lg:h-full lg:overflow-hidden"
        >
          {form}
        </div>
      </div>
    </div>
  );
}
