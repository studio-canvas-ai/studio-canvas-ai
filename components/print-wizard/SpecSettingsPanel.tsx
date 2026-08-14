"use client";

import { useState, type KeyboardEvent } from "react";
import {
  BG_PRESETS,
  PRINT_FORMATS,
  PRINT_USES,
  PRINT_PAGE_COUNTS,
  type BgPresetId,
  type PrintFormatId,
  type PrintUseId,
  type PrintPageCount,
} from "@/lib/printWizardTypes";
import { SMART_PROMPT_PRESETS } from "@/lib/printWizardPromptPresets";
import ControlBarDropdown, {
  ControlMenuItem,
} from "@/components/print-wizard/ControlBarDropdown";

export type SpecSettingsPanelProps = {
  formatId: PrintFormatId;
  useId: PrintUseId;
  pageCount: PrintPageCount;
  bgKeyword: string;
  bgPresetId: BgPresetId | null;
  selectedPromptPresetId: string | null;
  mainPrompt: string;
  generating?: boolean;
  submitting?: boolean;
  onFormatChange: (id: PrintFormatId) => void;
  onUseChange: (id: PrintUseId) => void;
  onPageCountChange: (count: PrintPageCount) => void;
  onBgKeywordChange: (keyword: string) => void;
  onBgPresetPick: (id: BgPresetId) => void;
  onGenerateBackground: () => void;
  onPromptPresetPick: (id: string, prompt: string) => void;
  onMainPromptChange: (value: string) => void;
  onSubmit: () => void;
};

type OpenKey = "format" | "use" | "pages" | "prompt" | "bg" | null;

/**
 * Center panel: 규격/용도/장수/예시/배경 compact row + main prompt.
 */
export default function SpecSettingsPanel({
  formatId,
  useId,
  pageCount,
  bgKeyword,
  bgPresetId,
  selectedPromptPresetId,
  mainPrompt,
  generating = false,
  submitting = false,
  onFormatChange,
  onUseChange,
  onPageCountChange,
  onBgKeywordChange,
  onBgPresetPick,
  onGenerateBackground,
  onPromptPresetPick,
  onMainPromptChange,
  onSubmit,
}: SpecSettingsPanelProps) {
  const [openKey, setOpenKey] = useState<OpenKey>(null);

  const onMainKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    if (!submitting) onSubmit();
  };

  return (
    <section className="flex h-full min-h-0 flex-col gap-2.5 overflow-hidden rounded-2xl border border-slate-800 bg-[#121824] p-3 shadow-[0_8px_32px_rgba(0,0,0,0.35)] sm:p-4">
      {/* 규격 · 용도 · 장수 · 예시 · 배경 — single compact row */}
      <div className="flex shrink-0 flex-row items-center gap-1.5">
        <ControlBarDropdown
          compact
          label="규격"
          value={PRINT_FORMATS.find((f) => f.id === formatId)?.label}
          open={openKey === "format"}
          onOpenChange={(v) => setOpenKey(v ? "format" : null)}
          menuMinWidth={200}
          menuMaxWidth={260}
        >
          {PRINT_FORMATS.map((fmt) => (
            <ControlMenuItem
              key={fmt.id}
              active={formatId === fmt.id}
              title={fmt.label}
              description={fmt.previewHint}
              onClick={() => {
                onFormatChange(fmt.id);
                setOpenKey(null);
              }}
            />
          ))}
        </ControlBarDropdown>

        <ControlBarDropdown
          compact
          label="용도"
          value={PRINT_USES.find((u) => u.id === useId)?.label}
          open={openKey === "use"}
          onOpenChange={(v) => setOpenKey(v ? "use" : null)}
          menuMinWidth={180}
          menuMaxWidth={220}
        >
          {PRINT_USES.map((item) => (
            <ControlMenuItem
              key={item.id}
              active={useId === item.id}
              title={item.label}
              onClick={() => {
                onUseChange(item.id);
                setOpenKey(null);
              }}
            />
          ))}
        </ControlBarDropdown>

        <ControlBarDropdown
          compact
          label="장수"
          value={
            PRINT_PAGE_COUNTS.find((p) => p.value === pageCount)?.label
          }
          open={openKey === "pages"}
          onOpenChange={(v) => setOpenKey(v ? "pages" : null)}
          menuMinWidth={160}
          menuMaxWidth={200}
        >
          {PRINT_PAGE_COUNTS.map((item) => (
            <ControlMenuItem
              key={item.value}
              active={pageCount === item.value}
              title={item.label}
              onClick={() => {
                onPageCountChange(item.value);
                setOpenKey(null);
              }}
            />
          ))}
        </ControlBarDropdown>

        <ControlBarDropdown
          compact
          label="예시"
          value={
            SMART_PROMPT_PRESETS.find((p) => p.id === selectedPromptPresetId)
              ?.label
          }
          open={openKey === "prompt"}
          onOpenChange={(v) => setOpenKey(v ? "prompt" : null)}
          menuMinWidth={300}
          menuMaxWidth={400}
        >
          {SMART_PROMPT_PRESETS.map((item) => (
            <ControlMenuItem
              key={item.id}
              active={selectedPromptPresetId === item.id}
              title={item.label}
              description={item.prompt}
              onClick={() => {
                onPromptPresetPick(item.id, item.prompt);
                setOpenKey(null);
              }}
            />
          ))}
        </ControlBarDropdown>

        <ControlBarDropdown
          compact
          label="배경"
          value={
            BG_PRESETS.find((p) => p.id === bgPresetId)?.label ??
            (bgKeyword.trim() ? "커스텀" : undefined)
          }
          open={openKey === "bg"}
          onOpenChange={(v) => setOpenKey(v ? "bg" : null)}
          menuMinWidth={300}
          menuMaxWidth={360}
        >
          <div className="space-y-3 p-2">
            <div className="flex flex-wrap gap-1.5">
              {BG_PRESETS.map((preset) => {
                const on = bgPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onBgPresetPick(preset.id)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                      on
                        ? "border-indigo-400/50 bg-indigo-500/20 text-indigo-100"
                        : "border-slate-700 bg-[#0E1420] text-slate-400 hover:border-slate-600 hover:text-slate-200"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <textarea
              value={bgKeyword}
              onChange={(e) => onBgKeywordChange(e.target.value)}
              rows={3}
              placeholder="커스텀 키워드…"
              className="w-full resize-y rounded-xl border border-slate-700 bg-[#0B0F19] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-slate-500 focus:ring-2 focus:ring-indigo-500/20"
            />
            <button
              type="button"
              disabled={generating || !bgKeyword.trim()}
              onClick={() => {
                onGenerateBackground();
                setOpenKey(null);
              }}
              className="w-full rounded-xl bg-indigo-500 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {generating ? "생성 중…" : "배경 생성"}
            </button>
          </div>
        </ControlBarDropdown>
      </div>

      <textarea
        value={mainPrompt}
        onChange={(e) => onMainPromptChange(e.target.value)}
        onKeyDown={onMainKeyDown}
        aria-label="메인 프롬프트 / 주문 내용"
        placeholder="예시에서 선택하거나 주문을 입력하세요. Enter로 초안 생성"
        className="min-h-0 w-full flex-1 resize-none rounded-xl border border-slate-700 bg-[#0E1420] px-3 py-2.5 text-sm leading-relaxed text-slate-100 outline-none placeholder:text-slate-600 focus:border-slate-500 focus:ring-2 focus:ring-indigo-500/20"
      />
    </section>
  );
}
