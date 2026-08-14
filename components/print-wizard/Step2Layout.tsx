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
      <div className="relative mx-auto grid h-full w-full max-w-[1600px] min-h-0 flex-1 grid-cols-1 gap-3 px-4 py-3 sm:gap-4 sm:px-5 sm:py-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(240px,0.78fr)_minmax(280px,0.95fr)] lg:overflow-hidden lg:pb-4">
        <div className="min-h-0 lg:h-full lg:overflow-hidden">{preview}</div>
        <div className="min-h-0 lg:h-full lg:overflow-hidden">{specs}</div>
        <div className="min-h-0 lg:h-full lg:overflow-hidden">{form}</div>
      </div>
    </div>
  );
}
