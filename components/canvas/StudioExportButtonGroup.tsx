"use client";

import type { RefObject } from "react";
import { Download, FolderOpen, Share2 } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import ScaGalleryLoadButton from "@/components/canvas/ScaGalleryLoadButton";
import type { StudioCanvasProjectV1 } from "@/lib/canvas/projectFile";
import { useDownloadQuota } from "@/lib/useDownloadQuota";

export type StudioExportButtonGroupProps = {
  busy?: boolean;
  onDownloadStandard: () => void;
  onDownloadHigh: () => void;
  /** Screen 26 — print-ready ultra/vector download trigger (UI only until credits backend). */
  onDownloadUltra?: () => void;
  onLoadProjectClick: () => void;
  onShare: () => void;
  fileInputRef?: RefObject<HTMLInputElement | null>;
  onFileChange?: (file: File | null) => void;
  /** Restore project from server FIFO `.sca` gallery (max 10). */
  onLoadFromGallery?: (project: StudioCanvasProjectV1) => void | Promise<void>;
  requireSubscription?: () => boolean;
  /** Template Studio right-rail sizing vs compact print preview. */
  variant?: "studio" | "compact" | "unified";
  showHint?: boolean;
};

/** Split "일반화질 다운로드 (2000회 ↓)" → title + quota for single-line buttons. */
function splitQuotaLabel(label: string): { title: string; quota: string | null } {
  const match = label.match(/^(.+?)\s*(\([^)]+\))\s*$/);
  if (!match) return { title: label, quota: null };
  return { title: match[1]!.trim(), quota: match[2]! };
}

/**
 * Download / load / share stack used by Template Studio and print-smart-form.
 * Download labels always show live FHD / 4K remaining (same as My Gallery).
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
    ? "inline-flex min-h-[2.85rem] w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-1.5 py-2 text-white shadow-[0_8px_24px_rgba(15,23,42,0.35)] disabled:opacity-50"
    : compact
      ? "inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-50"
      : "inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-50";

  const secondaryClass = unified
    ? "inline-flex w-full flex-row items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-2.5 text-[12px] font-semibold leading-none text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 [word-break:keep-all] whitespace-nowrap"
    : compact
      ? "inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-[#0E1420] px-3 py-2 text-[11px] font-medium text-slate-200 hover:bg-slate-800/60 disabled:opacity-50"
      : "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/85 hover:bg-white/10 disabled:opacity-50";

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
    ? "max-w-full text-[10px] font-extrabold tracking-tight [word-break:keep-all] sm:text-[11px]"
    : "";
  const downloadCreditClass = unified
    ? "shrink-0 text-[9px] font-bold tabular-nums sm:text-[10px]"
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

  const renderCreditLabel = (title: string, line2: string, line3?: string) => (
    <span className={labelClass}>
      <span className={downloadTitleClass}>{title}</span>
      {line2 ? (
        <span className={downloadCreditClass}>{line2}</span>
      ) : null}
      {line3 ? (
        <span className="max-w-full text-[8px] font-semibold leading-none opacity-90 [word-break:keep-all] sm:text-[9px]">
          {line3}
        </span>
      ) : null}
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
            <Download className={iconClass} aria-hidden />
            {renderCreditLabel(
              "일반화질 다운로드 (1 크레딧)",
              "(웹, SNS, 인쇄물)"
            )}
          </button>
          <button
            type="button"
            onClick={onDownloadHigh}
            disabled={busy || !canDownloadHigh}
            className={`${downloadClass} flex-1 border-white/20 bg-gradient-to-r from-violet-600 via-indigo-500 to-sky-500`}
          >
            <Download className={iconClass} aria-hidden />
            {renderCreditLabel(
              "고화질 다운로드 (2 크레딧)",
              "(고해상도, 포스터, 인쇄물)"
            )}
          </button>
          <button
            type="button"
            onClick={onDownloadUltra}
            disabled={busy || !onDownloadUltra || !canDownloadUltra}
            className={`${downloadClass} flex-1 border-amber-300/80 bg-gradient-to-r from-amber-600 via-orange-500 to-rose-500 ring-1 ring-amber-200/70`}
          >
            <Download className={iconClass} aria-hidden />
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
          (다운로드시 완성본과 보안 수정파일(.sca)이 함께 저장되며, 수정용파일은
          나중에 수정시 필요하니, 꼭 따로 저장바랍니다)
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
          <ScaGalleryLoadButton
            compact={false}
            disabled={busy}
            requireSubscription={requireSubscription}
            onLoadProject={onLoadFromGallery}
            className={secondaryClass}
          />
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
