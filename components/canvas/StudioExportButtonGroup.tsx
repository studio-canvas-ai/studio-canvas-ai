"use client";

import type { RefObject } from "react";
import { Download, FolderOpen, Images, Share2 } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import ScaGalleryLoadButton from "@/components/canvas/ScaGalleryLoadButton";
import type { StudioCanvasProjectV1 } from "@/lib/canvas/projectFile";
import { dispatchScaGalleryVault } from "@/lib/scaGalleryVaultUi";
import { useDownloadQuota } from "@/lib/useDownloadQuota";

export type StudioExportButtonGroupProps = {
  busy?: boolean;
  onDownloadStandard: () => void;
  onDownloadHigh: () => void;
  /** Screen 26 — print-ready ultra/vector download trigger. */
  onDownloadUltra?: () => void;
  onLoadProjectClick: () => void;
  onShare: () => void;
  fileInputRef?: RefObject<HTMLInputElement | null>;
  onFileChange?: (file: File | null) => void;
  /** Restore project from server FIFO `.sca` gallery. */
  onLoadFromGallery?: (project: StudioCanvasProjectV1) => void | Promise<void>;
  requireSubscription?: () => boolean;
  /** Template Studio right-rail sizing vs compact print preview. */
  variant?: "studio" | "compact" | "unified";
  showHint?: boolean;
  /**
   * Screen 26 — bottom gallery button opens the shared vault popover
   * (same UI as top-left 내 갤러리 저장).
   */
  useSharedGalleryVault?: boolean;
};

/** Split "일반화질 다운로드 (2000회 ↓)" → title + quota for single-line buttons. */
function splitQuotaLabel(label: string): { title: string; quota: string | null } {
  const match = label.match(/^(.+?)\s*(\([^)]+\))\s*$/);
  if (!match) return { title: label, quota: null };
  return { title: match[1]!.trim(), quota: match[2]! };
}

/**
 * Download / load / share stack used by Template Studio and print-smart-form.
 */
export default function StudioExportButtonGroup({
  busy = false,
  onDownloadStandard,
  onDownloadHigh,
  onDownloadUltra,
  onLoadProjectClick,
  onShare,
  fileInputRef,
  onFileChange,
  onLoadFromGallery,
  requireSubscription,
  variant = "studio",
  showHint = true,
  useSharedGalleryVault = false,
}: StudioExportButtonGroupProps) {
  const { t } = useI18n();
  const cs = t.canvasStudio;
  const { standardLabel, highLabel, canDownloadStandard, canDownloadHigh, canDownloadUltra } =
    useDownloadQuota();
  const compact = variant === "compact";
  const unified = variant === "unified";
  const standardParts = splitQuotaLabel(standardLabel);
  const highParts = splitQuotaLabel(highLabel);

  const downloadClass = unified
    ? "inline-flex min-h-[2.85rem] w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-1.5 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.35)] disabled:opacity-50"
    : compact
      ? "inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-50"
      : "inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-50";

  const secondaryClass = unified
    ? "inline-flex w-full flex-row items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-2.5 text-[12px] font-semibold leading-none text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 [word-break:keep-all] whitespace-nowrap"
    : compact
      ? "inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-[#0E1420] px-3 py-2 text-[11px] font-medium text-slate-200 hover:bg-slate-800/60 disabled:opacity-50"
      : "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/85 hover:bg-white/10 disabled:opacity-50";

  const galleryVaultBtnClass =
    "inline-flex w-full flex-row items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-100 px-2 py-2.5 text-[12px] font-semibold leading-none text-amber-950 hover:border-amber-400 hover:bg-amber-200 disabled:opacity-50 [word-break:keep-all] whitespace-nowrap";

  const iconClass = unified
    ? "h-3.5 w-3.5 shrink-0"
    : compact
      ? "h-3.5 w-3.5"
      : "h-4 w-4 shrink-0";
  const hintClass = unified
    ? "px-0.5 text-center text-[9px] font-semibold leading-snug text-slate-900"
    : compact
      ? "px-0.5 text-center text-[10px] leading-snug text-slate-400"
      : "text-center text-xs leading-snug text-white/45";
  const labelClass = unified
    ? "inline-flex min-w-0 max-w-full flex-col items-center gap-0.5 text-center leading-tight"
    : compact
      ? "min-w-0 text-center text-[10px] font-semibold leading-tight [word-break:keep-all]"
      : "min-w-0 text-center text-[12px] font-semibold leading-tight [word-break:keep-all] sm:text-sm";
  const downloadTitleClass = unified
    ? "max-w-full text-[12px] font-extrabold leading-tight tracking-tight text-black [word-break:keep-all] sm:text-[13px]"
    : "";
  const downloadCreditClass = unified
    ? "shrink-0 text-[11px] font-bold tabular-nums text-white sm:text-[12px]"
    : "";
  const downloadQuotaClass = unified
    ? "shrink-0 text-[11px] font-bold sm:text-[12px]"
    : "";

  const renderDownloadLabel = (
    full: string,
    parts: { title: string; quota: string | null }
  ) =>
    unified && parts.quota ? (
      <>
        <span className={downloadTitleClass}>{parts.title}</span>
        <span className={downloadQuotaClass}>{parts.quota}</span>
      </>
    ) : (
      full
    );

  /** Screen 26: exactly two lines — black title + white credit. */
  const renderCreditLabel = (title: string, credit: string) => (
    <span className={labelClass}>
      <span className={downloadTitleClass}>{title}</span>
      <span className={downloadCreditClass}>{credit}</span>
    </span>
  );

  return (
    <div
      className={
        unified
          ? "mt-auto grid shrink-0 gap-1.5 border-t border-slate-200 pt-3"
          : compact
            ? "grid shrink-0 gap-1.5 border-t border-slate-800/80 pt-1.5"
            : "mt-auto grid shrink-0 gap-2 border-t border-white/10 pt-4"
      }
    >
      {unified ? (
        <div className="flex w-full min-w-0 flex-row items-stretch gap-1.5">
          <button
            type="button"
            onClick={onDownloadStandard}
            disabled={busy || !canDownloadStandard}
            className={`${downloadClass} flex-1 border-white/20 bg-gradient-to-r from-teal-500 via-emerald-500 to-emerald-400`}
          >
            <Download className={`${iconClass} text-white`} aria-hidden />
            {renderCreditLabel("일반화질 다운로드", "(1 크레딧)")}
          </button>
          <button
            type="button"
            onClick={onDownloadHigh}
            disabled={busy || !canDownloadHigh}
            className={`${downloadClass} flex-1 border-white/20 bg-gradient-to-r from-violet-600 via-indigo-500 to-sky-500`}
          >
            <Download className={`${iconClass} text-white`} aria-hidden />
            {renderCreditLabel("고화질 다운로드", "(2 크레딧)")}
          </button>
          <button
            type="button"
            onClick={onDownloadUltra}
            disabled={busy || !onDownloadUltra || !canDownloadUltra}
            className={`${downloadClass} flex-1 border-amber-300/80 bg-gradient-to-r from-amber-600 via-orange-500 to-rose-500 ring-1 ring-amber-200/70`}
          >
            <Download className={`${iconClass} text-white`} aria-hidden />
            {renderCreditLabel("초고해상도 다운로드", "(5 크레딧)")}
          </button>
        </div>
      ) : (
        <div className={`grid grid-cols-2 ${compact ? "gap-1.5" : "gap-1.5"}`}>
          <button
            type="button"
            onClick={onDownloadStandard}
            disabled={busy || !canDownloadStandard}
            className={`${downloadClass} bg-gradient-to-r from-teal-500 via-emerald-500 to-emerald-400`}
          >
            <Download className={iconClass} />
            <span className={labelClass}>
              {renderDownloadLabel(standardLabel, standardParts)}
            </span>
          </button>
          <button
            type="button"
            onClick={onDownloadHigh}
            disabled={busy || !canDownloadHigh}
            className={`${downloadClass} bg-gradient-to-r from-violet-600 via-indigo-500 to-sky-500`}
          >
            <Download className={iconClass} />
            <span className={labelClass}>
              {renderDownloadLabel(highLabel, highParts)}
            </span>
          </button>
        </div>
      )}
      {showHint ? (
        <p className={hintClass}>
          (다운로드 시 완성본과 수정용 .sca는 기기에, 수정용 .sca는 최근 파일·내
          갤러리·템플릿 창고에도 함께 보관됩니다)
        </p>
      ) : null}
      {unified && onLoadFromGallery ? (
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={onLoadProjectClick}
            disabled={busy}
            className={secondaryClass}
          >
            <FolderOpen className={iconClass} aria-hidden />
            <span className="min-w-0 truncate">{cs.loadEditFile}</span>
          </button>
          {useSharedGalleryVault ? (
            <button
              type="button"
              disabled={busy}
              className={galleryVaultBtnClass}
              onClick={(e) => {
                if (requireSubscription && !requireSubscription()) return;
                dispatchScaGalleryVault({
                  action: "toggle",
                  anchor: e.currentTarget,
                });
              }}
            >
              <Images className={iconClass} aria-hidden />
              <span className="min-w-0 truncate">내갤러리불러오기</span>
            </button>
          ) : (
            <ScaGalleryLoadButton
              compact={false}
              disabled={busy}
              tone="light"
              requireSubscription={requireSubscription}
              onLoadProject={onLoadFromGallery}
              className={secondaryClass}
            />
          )}
          <button
            type="button"
            onClick={onShare}
            disabled={busy}
            className={secondaryClass}
          >
            <Share2 className={iconClass} aria-hidden />
            <span className="min-w-0 truncate">{cs.share}</span>
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={onLoadProjectClick}
              disabled={busy}
              className={secondaryClass}
            >
              <FolderOpen className={iconClass} />
              {cs.loadEditFile}
            </button>
            {onLoadFromGallery ? (
              <ScaGalleryLoadButton
                compact={compact}
                disabled={busy}
                requireSubscription={requireSubscription}
                onLoadProject={onLoadFromGallery}
              />
            ) : (
              <button
                type="button"
                onClick={onShare}
                disabled={busy}
                className={secondaryClass}
              >
                <Share2 className={iconClass} />
                {cs.share}
              </button>
            )}
          </div>
          {onLoadFromGallery ? (
            <button
              type="button"
              onClick={onShare}
              disabled={busy}
              className={secondaryClass}
            >
              <Share2 className={iconClass} />
              {cs.share}
            </button>
          ) : null}
        </>
      )}
      {fileInputRef && onFileChange ? (
        <input
          ref={fileInputRef}
          type="file"
          accept=".sca,.sca.json,.json,application/octet-stream,application/json"
          className="hidden"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
      ) : null}
    </div>
  );
}
