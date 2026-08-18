"use client";

import type { RefObject } from "react";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import StudioExportButtonGroup from "@/components/canvas/StudioExportButtonGroup";
import { fillCanvas } from "@/lib/i18n";
import { EDITOR_PAGE_SLOTS } from "@/lib/printWizardTextLayers";

export type SmartInputFormProps = {
  currentPage?: number;
  onSelectPage?: (page: number) => void;
  /** Step 1 wizard — replaces download/share stack with planning CTAs. */
  wizardMode?: boolean;
  draftBusy?: boolean;
  finishBusy?: boolean;
  draftReady?: boolean;
  onGenerateDraft?: () => void;
  onFinishStep?: () => void;
  exportBusy?: boolean;
  onDownloadStandard?: () => void;
  onDownloadHigh?: () => void;
  onLoadProjectClick?: () => void;
  onShare?: () => void;
  projectFileInputRef?: RefObject<HTMLInputElement | null>;
  onProjectFileChange?: (file: File | null) => void;
};

const PAGE_BUTTONS = Array.from({ length: EDITOR_PAGE_SLOTS }, (_, i) => i + 1);

/**
 * Right panel — page buttons only (2×4). Layer editing lives in a canvas-sized modal.
 */
export default function SmartInputForm({
  currentPage = 1,
  onSelectPage,
  wizardMode = false,
  draftBusy = false,
  finishBusy = false,
  draftReady = false,
  onGenerateDraft,
  onFinishStep,
  exportBusy = false,
  onDownloadStandard,
  onDownloadHigh,
  onLoadProjectClick,
  onShare,
  projectFileInputRef,
  onProjectFileChange,
}: SmartInputFormProps) {
  const { t } = useI18n();
  const cs = t.canvasStudio;

  return (
    <section className="relative z-[1] flex h-full min-h-0 flex-col gap-2.5 rounded-2xl border border-slate-800 bg-[#121824] p-3 shadow-[0_8px_32px_rgba(0,0,0,0.35)] pointer-events-auto sm:p-4">
      <header className="shrink-0 px-0.5 pt-0.5">
        <h2 className="text-[15px] font-semibold text-slate-100 sm:text-base">
          {cs.detailContent}
        </h2>
      </header>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain rounded-xl border border-slate-800 bg-[#0E1420]/80 p-2.5 sm:p-3">
        <div className="grid grid-cols-4 gap-1.5">
          {PAGE_BUTTONS.slice(0, 4).map((page) => (
            <button
              key={page}
              type="button"
              aria-pressed={currentPage === page}
              onClick={() => onSelectPage?.(page)}
              className={`h-9 w-full rounded-lg border px-1 text-[11px] font-semibold [word-break:keep-all] transition ${
                currentPage === page
                  ? "border-indigo-400/60 bg-indigo-500/20 text-indigo-100"
                  : "border-slate-700 bg-[#0B0F19] text-slate-300 hover:border-slate-500 hover:text-white"
              }`}
            >
              {fillCanvas(cs.pageTab, { n: page })}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {PAGE_BUTTONS.slice(4, 8).map((page) => (
            <button
              key={page}
              type="button"
              aria-pressed={currentPage === page}
              onClick={() => onSelectPage?.(page)}
              className={`h-9 w-full rounded-lg border px-1 text-[11px] font-semibold [word-break:keep-all] transition ${
                currentPage === page
                  ? "border-indigo-400/60 bg-indigo-500/20 text-indigo-100"
                  : "border-slate-700 bg-[#0B0F19] text-slate-300 hover:border-slate-500 hover:text-white"
              }`}
            >
              {fillCanvas(cs.pageTab, { n: page })}
            </button>
          ))}
        </div>
        <div className="min-h-16" aria-hidden />
      </div>

      {wizardMode ? (
        <div className="shrink-0 space-y-2">
          {draftReady ? (
            <p className="px-0.5 text-[11px] text-emerald-300/90">
              {cs.wizardDraftReady}
            </p>
          ) : null}
          <button
            type="button"
            disabled={draftBusy || finishBusy}
            onClick={onGenerateDraft}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {draftBusy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {cs.wizardDraftGenerating}
              </>
            ) : (
              cs.wizardGenerateDraft
            )}
          </button>
          <button
            type="button"
            disabled={finishBusy || draftBusy}
            onClick={onFinishStep}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {finishBusy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {cs.processing}
              </>
            ) : (
              cs.wizardFinishStep
            )}
          </button>
        </div>
      ) : (
        onDownloadStandard &&
        onDownloadHigh &&
        onLoadProjectClick &&
        onShare &&
        projectFileInputRef &&
        onProjectFileChange && (
          <StudioExportButtonGroup
            busy={exportBusy}
            onDownloadStandard={onDownloadStandard}
            onDownloadHigh={onDownloadHigh}
            onLoadProjectClick={onLoadProjectClick}
            onShare={onShare}
            fileInputRef={projectFileInputRef}
            onFileChange={onProjectFileChange}
            variant="studio"
            showHint
          />
        )
      )}
    </section>
  );
}
