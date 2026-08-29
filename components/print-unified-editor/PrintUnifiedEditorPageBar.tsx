"use client";

import { EDITOR_PAGE_SLOTS } from "@/lib/printWizardTextLayers";

export type PrintUnifiedEditorPageBarProps = {
  /** 0 = idle (no tab selected yet). */
  currentPage: number;
  pageCount: number;
  onSelectPage: (page: number) => void;
};

const PAGE_BUTTONS = Array.from({ length: EDITOR_PAGE_SLOTS }, (_, i) => i + 1);

/**
 * Fixed 8-slot page switcher — matches Screen 8 content page structure.
 */
export default function PrintUnifiedEditorPageBar({
  currentPage,
  pageCount,
  onSelectPage,
}: PrintUnifiedEditorPageBarProps) {
  return (
    <div className="shrink-0 rounded-xl border border-slate-700/60 bg-slate-800/50 p-2 backdrop-blur-sm">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
        페이지
      </p>
      <div className="grid grid-cols-4 gap-1.5">
        {PAGE_BUTTONS.map((page) => {
          const active = currentPage > 0 && page === currentPage;
          const disabled = page > pageCount;
          return (
            <button
              key={page}
              type="button"
              disabled={disabled}
              onClick={() => onSelectPage(page)}
              className={`rounded-lg px-1 py-1.5 text-[11px] font-bold tabular-nums transition ${
                active
                  ? "bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/45"
                  : disabled
                    ? "cursor-not-allowed bg-white/5 text-white/25"
                    : "bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {page}페이지
            </button>
          );
        })}
      </div>
    </div>
  );
}
