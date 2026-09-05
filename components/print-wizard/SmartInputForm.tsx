"use client";

import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import StudioExportButtonGroup from "@/components/canvas/StudioExportButtonGroup";
import { fillCanvas } from "@/lib/i18n";
import { EDITOR_PAGE_SLOTS } from "@/lib/printWizardTextLayers";
import type { PrintWizardState } from "@/lib/printWizardTypes";
import type { WizardDraftMeta } from "@/lib/wizard/wizardDraftStorage";
import {
  listPrintDrafts,
  loadPrintDraft,
} from "@/lib/printWizardDrafts";

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
  /** Called when user selects a draft to restore. */
  onRestoreDraft?: (state: PrintWizardState) => void;
  listDrafts?: () => WizardDraftMeta[];
  loadDraft?: (id: string) => PrintWizardState | null;
  draftsChangedEvent?: string;
  showWizardFinishAction?: boolean;
  exportBusy?: boolean;
  onDownloadStandard?: () => void;
  onDownloadHigh?: () => void;
  onLoadProjectClick?: () => void;
  onShare?: () => void;
  projectFileInputRef?: RefObject<HTMLInputElement | null>;
  onProjectFileChange?: (file: File | null) => void;
};

const PAGE_BUTTONS = Array.from({ length: EDITOR_PAGE_SLOTS }, (_, i) => i + 1);

function DraftDropdown({
  onRestore,
  listDrafts,
  loadDraft,
  draftsChangedEvent = "sca:print-drafts-changed",
}: {
  onRestore?: (state: PrintWizardState) => void;
  listDrafts: () => WizardDraftMeta[];
  loadDraft: (id: string) => PrintWizardState | null;
  draftsChangedEvent?: string;
}) {
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<WizardDraftMeta[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const refresh = () => setDrafts(listDrafts());

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener(draftsChangedEvent, handler);
    return () => window.removeEventListener(draftsChangedEvent, handler);
  }, [draftsChangedEvent, listDrafts]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handlePick = (id: string) => {
    const state = loadDraft(id);
    if (state && onRestore) onRestore(state);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { refresh(); setOpen((v) => !v); }}
        className="flex w-full items-center justify-between gap-1.5 rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-[12px] font-semibold text-amber-200 transition hover:bg-amber-500/20"
      >
        <span>임시초안 불러오기 <span className="text-amber-400/70">({drafts.length}/10장)</span></span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-[9999] mt-1 w-full min-w-[200px] overflow-hidden rounded-xl border border-slate-700 bg-[#121824] shadow-2xl">
          {drafts.length === 0 ? (
            <p className="px-3 py-3 text-[11px] text-slate-500">저장된 초안이 없습니다.</p>
          ) : (
            <ul className="max-h-60 overflow-y-auto">
              {drafts.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => handlePick(d.id)}
                    className="w-full px-3 py-2.5 text-left text-[11px] text-slate-300 transition hover:bg-slate-700/60"
                  >
                    {d.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

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
  onRestoreDraft,
  listDrafts = listPrintDrafts,
  loadDraft = loadPrintDraft,
  draftsChangedEvent = "sca:print-drafts-changed",
  showWizardFinishAction = true,
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
      <header className="shrink-0 space-y-2 px-0.5 pt-0.5">
        {wizardMode && (
          <DraftDropdown
            onRestore={onRestoreDraft}
            listDrafts={listDrafts}
            loadDraft={loadDraft}
            draftsChangedEvent={draftsChangedEvent}
          />
        )}
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
        <div className="mt-3 rounded-xl border border-pink-400/45 bg-gradient-to-br from-pink-500/15 via-[#121824] to-indigo-500/10 px-3 py-3 shadow-[0_0_0_1px_rgba(244,114,182,0.12)]">
          <p className="text-[15px] font-semibold leading-snug text-pink-100 [word-break:keep-all] sm:text-base">
            {cs.pageFillHint1}
          </p>
          <p className="mt-1 text-[15px] font-semibold leading-snug text-pink-100 [word-break:keep-all] sm:text-base">
            {cs.pageFillHint2}
          </p>
        </div>
      </div>

      {wizardMode && showWizardFinishAction ? (
        <div className="shrink-0 space-y-2">
          {draftReady ? (
            <p className="px-0.5 text-[11px] text-emerald-300/90">
              {cs.wizardDraftReady}
            </p>
          ) : null}
          <button
            type="button"
            disabled={finishBusy || draftBusy}
            onClick={onFinishStep}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
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
      ) : wizardMode ? null : (
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
