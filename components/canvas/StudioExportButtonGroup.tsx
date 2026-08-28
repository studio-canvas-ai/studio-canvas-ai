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
  const { standardLabel, highLabel, canDownloadStandard, canDownloadHigh } =
    useDownloadQuota();
  const compact = variant === "compact";
  const unified = variant === "unified";
  const standardParts = splitQuotaLabel(standardLabel);
  const highParts = splitQuotaLabel(highLabel);

  const downloadClass = unified
    ? "inline-flex w-full min-h-[2.85rem] items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-white disabled:opacity-50"
    : compact
      ? "inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-50"
      : "inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-50";

  const secondaryClass = unified
    ? "inline-flex w-full flex-row items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2 py-2.5 text-[12px] font-semibold leading-none text-white hover:bg-white/10 disabled:opacity-50 [word-break:keep-all] whitespace-nowrap"
    : compact
      ? "inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-[#0E1420] px-3 py-2 text-[11px] font-medium text-slate-200 hover:bg-slate-800/60 disabled:opacity-50"
      : "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/85 hover:bg-white/10 disabled:opacity-50";

  const iconClass = unified
    ? "h-4 w-4 shrink-0"
    : compact
      ? "h-3.5 w-3.5"
      : "h-4 w-4 shrink-0";
  const hintClass = unified
    ? "px-0.5 text-center text-[9px] leading-snug text-white/40"
    : compact
      ? "px-0.5 text-center text-[10px] leading-snug text-slate-400"
      : "text-center text-xs leading-snug text-white/45";
  const labelClass = unified
    ? "inline-flex min-w-0 max-w-full items-baseline gap-1 whitespace-nowrap leading-none"
    : compact
      ? "min-w-0 text-center text-[10px] font-semibold leading-tight [word-break:keep-all]"
      : "min-w-0 text-center text-[12px] font-semibold leading-tight [word-break:keep-all] sm:text-sm";
  const downloadTitleClass = unified
    ? "truncate text-[13px] font-bold sm:text-[14px]"
    : "";
  const downloadQuotaClass = unified
    ? "shrink-0 text-[11px] font-semibold sm:text-[12px]"
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

  return (
    <div
      className={
        unified
          ? "mt-auto grid shrink-0 gap-1.5 border-t border-white/10 pt-3"
          : compact
            ? "grid shrink-0 gap-1.5 border-t border-slate-800/80 pt-1.5"
            : "mt-auto grid shrink-0 gap-2 border-t border-white/10 pt-4"
      }
    >
      <div className={`grid grid-cols-2 ${unified ? "gap-2" : "gap-1.5"}`}>
        <button
          type="button"
          onClick={onDownloadStandard}
          disabled={busy || !canDownloadStandard}
          className={`${downloadClass} bg-gradient-to-r from-teal-600 to-emerald-500`}
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
          className={`${downloadClass} bg-gradient-to-r from-purple-600 to-indigo-500`}
        >
          <Download className={iconClass} />
          <span className={labelClass}>
            {renderDownloadLabel(highLabel, highParts)}
          </span>
        </button>
      </div>
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
