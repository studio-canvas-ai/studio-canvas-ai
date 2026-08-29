"use client";

import { useMemo } from "react";
import { useI18n } from "@/components/I18nProvider";
import { fillCanvas } from "@/lib/i18n";
import { pageBackgroundUrl, bgPanObjectPosition } from "@/lib/printWizardBg";
import { EDITOR_PAGE_SLOTS } from "@/lib/printWizardTextLayers";
import { resolvePrintAspect } from "@/lib/printWizardTypes";
import type {
  PrintBackgroundPan,
  PrintCustomSize,
  PrintFormatId,
} from "@/lib/printWizardTypes";

export type PrintUnifiedEditorMiniThumbsProps = {
  formatId: PrintFormatId;
  customSize: PrintCustomSize | null;
  pageCount: number;
  /** 0 = none selected. */
  currentPage: number;
  backgroundUrl: string | null;
  backgroundUrls: (string | null)[];
  backgroundPansByPage?: PrintBackgroundPan[];
  onSelectPage: (page: number) => void;
};

const THUMB_PAGES = Array.from({ length: EDITOR_PAGE_SLOTS }, (_, i) => i + 1);

/**
 * Compact 8-page mini strip — ~half prior height, pinned to column bottom.
 */
export default function PrintUnifiedEditorMiniThumbs({
  formatId,
  customSize,
  pageCount,
  currentPage,
  backgroundUrl,
  backgroundUrls,
  backgroundPansByPage,
  onSelectPage,
}: PrintUnifiedEditorMiniThumbsProps) {
  const { t } = useI18n();
  const cs = t.canvasStudio;
  const aspect = resolvePrintAspect(formatId, customSize);

  const thumbStyle = useMemo(
    () => ({
      aspectRatio: `${aspect}`,
      height: "3.25rem",
      width: "auto",
      maxWidth: "100%",
    }),
    [aspect]
  );

  return (
    <div className="w-full shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-1.5 py-1.5 shadow-sm">
      <div className="mb-1 flex items-center justify-between gap-1.5">
        <p className="text-[10px] font-semibold leading-none text-slate-800">
          {fillCanvas(cs.miniView, { label: "8페이지" })}
        </p>
        <span className="text-[9px] font-semibold tabular-nums leading-none text-slate-900">
          {pageCount}면
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {THUMB_PAGES.map((page) => {
          const index = page - 1;
          const disabled = page > pageCount;
          const active = currentPage > 0 && page === currentPage;
          const thumbBg = disabled
            ? null
            : pageBackgroundUrl(backgroundUrls, backgroundUrl, index);
          const pan = backgroundPansByPage?.[index];

          return (
            <button
              key={page}
              type="button"
              disabled={disabled}
              onClick={() => onSelectPage(page)}
              aria-label={`${page}페이지`}
              aria-current={active ? "page" : undefined}
              className={`group min-w-0 rounded p-0.5 transition ${
                disabled
                  ? "cursor-not-allowed opacity-35"
                  : active
                    ? "bg-emerald-50 ring-1 ring-emerald-400/60"
                    : "hover:bg-slate-100"
              }`}
            >
              <div
                className={`relative mx-auto overflow-hidden rounded border bg-white ${
                  active
                    ? "border-emerald-400 shadow-sm"
                    : "border-slate-200 group-hover:border-slate-300"
                }`}
                style={thumbStyle}
              >
                {thumbBg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbBg}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{
                      objectPosition: pan
                        ? bgPanObjectPosition(pan)
                        : "50% 50%",
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-white to-slate-200" />
                )}
                <span
                  className={`absolute bottom-px left-px z-[1] rounded px-0.5 text-[7px] font-bold leading-tight ${
                    active
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-800/80 text-white"
                  }`}
                >
                  {page}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
