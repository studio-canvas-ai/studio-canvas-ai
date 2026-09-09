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
    <div className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-2 shadow-sm">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-900">
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
                  ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-400/50"
                  : disabled
                    ? "cursor-not-allowed bg-slate-100 text-slate-300"
                    : "bg-white text-slate-700 shadow-sm hover:bg-slate-100 hover:text-slate-900"
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
