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
  /** Saved slot previews (composite); falls back to background when empty. */
  pageThumbUrls?: (string | null)[];
  backgroundPansByPage?: PrintBackgroundPan[];
  onSelectPage: (page: number) => void;
};

const THUMB_PAGES = Array.from({ length: EDITOR_PAGE_SLOTS }, (_, i) => i + 1);

/**
 * Compact 8-page mini strip — mobile ~half height; desktop full size, pinned to column bottom.
 */
export default function PrintUnifiedEditorMiniThumbs({
  formatId,
  customSize,
  pageCount,
  currentPage,
  backgroundUrl,
  backgroundUrls,
  pageThumbUrls,
  backgroundPansByPage,
  onSelectPage,
}: PrintUnifiedEditorMiniThumbsProps) {
  const { t } = useI18n();
  const cs = t.canvasStudio;
  const aspect = resolvePrintAspect(formatId, customSize);

  const thumbStyle = useMemo(
    () => ({
      aspectRatio: `${aspect}`,
      width: "auto",
      maxWidth: "100%",
    }),
    [aspect]
  );

  return (
    <div className="w-full shrink-0 rounded-lg border border-sky-200 bg-sky-50 px-1 py-1 shadow-sm lg:rounded-xl lg:px-1.5 lg:py-1.5">
      <div className="mb-0.5 flex items-center justify-between gap-1 lg:mb-1 lg:gap-1.5">
        <p className="text-[9px] font-semibold leading-none text-slate-800 lg:text-[10px]">
          {fillCanvas(cs.miniView, { label: "8페이지" })}
        </p>
        <span className="text-[8px] font-semibold tabular-nums leading-none text-slate-900 lg:text-[9px]">
          8면
        </span>
      </div>
      <div className="grid grid-cols-4 gap-0.5 lg:gap-1">
        {THUMB_PAGES.map((page) => {
          const index = page - 1;
          const disabled = false;
          const active = currentPage > 0 && page === currentPage;
          const thumbFromSlot = pageThumbUrls?.[index]?.trim();
          const thumbBg = disabled
            ? null
            : thumbFromSlot ||
              pageBackgroundUrl(backgroundUrls, backgroundUrl, index);
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
                className={`relative mx-auto h-[1.625rem] overflow-hidden rounded border bg-white lg:h-[3.25rem] ${
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
