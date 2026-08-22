"use client";

import type { RefObject } from "react";
import { Download, FolderOpen, Share2 } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import ScaGalleryLoadButton from "@/components/canvas/ScaGalleryLoadButton";
import type { StudioCanvasProjectV1 } from "@/lib/canvas/projectFile";

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
  variant?: "studio" | "compact";
  showHint?: boolean;
};

/**
 * Download / load / share stack used by Template Studio and print-smart-form.
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
  const compact = variant === "compact";

  const downloadClass = compact
    ? "inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-50"
    : "inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-50";

  const secondaryClass = compact
    ? "inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-[#0E1420] px-3 py-2 text-[11px] font-medium text-slate-200 hover:bg-slate-800/60 disabled:opacity-50"
    : "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/85 hover:bg-white/10 disabled:opacity-50";

  const iconClass = compact ? "h-3.5 w-3.5" : "h-4 w-4 shrink-0";
  const hintClass = compact
    ? "px-0.5 text-center text-[10px] leading-snug text-slate-400"
    : "text-center text-xs leading-snug text-white/45";

  return (
    <div
      className={
        compact
          ? "grid shrink-0 gap-1.5 border-t border-slate-800/80 pt-1.5"
          : "mt-auto grid shrink-0 gap-2 border-t border-white/10 pt-4"
      }
    >
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={onDownloadStandard}
          disabled={busy}
          className={`${downloadClass} bg-gradient-to-r from-teal-600 to-emerald-500`}
        >
          <Download className={iconClass} />
          {cs.downloadStandard}
        </button>
        <button
          type="button"
          onClick={onDownloadHigh}
          disabled={busy}
          className={`${downloadClass} bg-gradient-to-r from-purple-600 to-indigo-500`}
        >
          <Download className={iconClass} />
          {cs.downloadHigh}
        </button>
      </div>
      <p className={hintClass}>
        (다운로드시 완성본과 보안 수정파일(.sca)이 함께 저장되며, 수정용파일은 나중에 수정시 필요하니, 꼭 따로 저장바랍니다)
      </p>
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
