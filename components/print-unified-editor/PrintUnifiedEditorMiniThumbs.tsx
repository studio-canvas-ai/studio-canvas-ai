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
 * Middle-column 8-page mini thumbnail strip — always visible, tap to switch canvas.
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
    }),
    [aspect]
  );

  return (
    <div className="shrink-0 rounded-xl border border-white/10 bg-black/30 p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-white/75">
          {fillCanvas(cs.miniView, { label: "8페이지" })}
        </p>
        <span className="text-[10px] tabular-nums text-white/40">
          {pageCount}면 프로젝트
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-4">
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
              className={`group flex min-w-0 flex-col gap-1 rounded-lg p-1 transition ${
                disabled
                  ? "cursor-not-allowed opacity-35"
                  : active
                    ? "bg-emerald-500/15 ring-1 ring-emerald-400/50"
                    : "hover:bg-white/5"
              }`}
            >
              <div
                className={`relative w-full overflow-hidden rounded-md border bg-[#0B0F19] ${
                  active
                    ? "border-emerald-400/55 shadow-[0_0_0_1px_rgba(52,211,153,0.2)]"
                    : "border-slate-700/80 group-hover:border-slate-500"
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
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(99,102,241,0.18),transparent_55%),linear-gradient(160deg,#1a2234,#0B0F19)]" />
                )}
                <span
                  className={`absolute bottom-0.5 left-0.5 z-[1] rounded px-1 py-px text-[8px] font-bold ${
                    active
                      ? "bg-emerald-600/90 text-white"
                      : "bg-black/60 text-white/85"
                  }`}
                >
                  {page}
                </span>
              </div>
              <span
                className={`truncate text-center text-[9px] font-medium ${
                  active ? "text-emerald-200" : "text-white/50"
                }`}
              >
                {page}페이지
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
