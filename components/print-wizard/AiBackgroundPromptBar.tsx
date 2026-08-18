"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  ChevronDown,
  Loader2,
  MoreHorizontal,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import {
  FIELD_CATEGORIES,
  type BgPresetId,
} from "@/lib/printWizardTypes";

export type AiBackgroundPromptBarProps = {
  value: string;
  generating?: boolean;
  bgPresetId?: BgPresetId | null;
  /** Hint under the field, e.g. A4 · 팸플릿 · 4면 */
  contextHint?: string;
  onChange: (value: string) => void;
  onPresetPick: (id: BgPresetId) => void;
  onGenerate: () => void;
  /** Optional order prompt shown when expanded. */
  expandedContent?: ReactNode;
};

/**
 * Compact Adobe-inspired toolbar + full-width 「AI 배경 생성」 prompt.
 */
export default function AiBackgroundPromptBar({
  value,
  generating = false,
  bgPresetId = null,
  contextHint = "",
  onChange,
  onPresetPick,
  onGenerate,
  expandedContent,
}: AiBackgroundPromptBarProps) {
  const { t } = useI18n();
  const cs = t.canvasStudio;
  const [orderOpen, setOrderOpen] = useState(false);
  const [moodOpen, setMoodOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!moodOpen && !optionsOpen) return;
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t || rootRef.current?.contains(t)) return;
      setMoodOpen(false);
      setOptionsOpen(false);
    };
    const onDocKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setMoodOpen(false);
        setOptionsOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onDocKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onDocKey);
    };
  }, [moodOpen, optionsOpen]);

  const canSend = !generating;

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    if (canSend) onGenerate();
  };

  const toolBtn = (active: boolean) =>
    `inline-flex h-7 w-7 items-center justify-center rounded-full border transition ${
      active
        ? "border-indigo-400/45 bg-indigo-500/15 text-indigo-200"
        : "border-slate-700/80 bg-[#0E1420] text-slate-400 hover:border-slate-600 hover:text-slate-200"
    }`;

  return (
    <div ref={rootRef} className="relative w-full shrink-0 space-y-2">
      {/* Compact tool strip — petite, not dominant */}
      <div className="flex w-full items-center gap-1.5">
        <div className="relative flex items-center gap-1">
          <button
            type="button"
            aria-label="배경 분위기 프리셋"
            aria-expanded={moodOpen}
            onClick={() => {
              setMoodOpen((v) => !v);
              setOptionsOpen(false);
            }}
            className={toolBtn(moodOpen)}
          >
            <Wand2 className="h-3.5 w-3.5" aria-hidden />
          </button>

          {moodOpen ? (
            <div className="absolute top-[calc(100%+6px)] left-0 z-30 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-slate-700/80 bg-[#121824] p-2 shadow-[0_12px_32px_rgba(0,0,0,0.5)]">
              <p className="mb-1.5 px-1 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
                배경 분위기
              </p>
              <div className="flex flex-wrap gap-1">
                {FIELD_CATEGORIES.map((group) => {
                  const first = group.items[0]!;
                  const on = Boolean(
                    bgPresetId &&
                      group.items.some((item) => item.id === bgPresetId)
                  );
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => {
                        onPresetPick(first.id);
                        setMoodOpen(false);
                      }}
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold [word-break:keep-all] transition ${
                        on
                          ? "border-indigo-400/50 bg-indigo-500/20 text-indigo-100"
                          : "border-slate-700 bg-[#0E1420] text-slate-400 hover:border-slate-600 hover:text-slate-200"
                      }`}
                    >
                      {cs.fieldGroups[group.id]}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-indigo-300">
            BETA
          </span>
          <div className="relative">
            <button
              type="button"
              aria-label="옵션"
              aria-expanded={optionsOpen}
              onClick={() => {
                setOptionsOpen((v) => !v);
                setMoodOpen(false);
              }}
              className={toolBtn(optionsOpen)}
            >
              <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
            </button>
            {optionsOpen ? (
              <div className="absolute top-[calc(100%+6px)] right-0 z-30 w-40 overflow-hidden rounded-lg border border-slate-700 bg-[#121824] py-1 shadow-xl">
                <button
                  type="button"
                  className="block w-full px-2.5 py-1.5 text-left text-[11px] font-medium text-slate-300 hover:bg-slate-800"
                  onClick={() => {
                    onChange("");
                    setOptionsOpen(false);
                    textareaRef.current?.focus();
                  }}
                >
                  입력 내용 지우기
                </button>
                <button
                  type="button"
                  className="block w-full px-2.5 py-1.5 text-left text-[11px] font-medium text-slate-300 hover:bg-slate-800"
                  onClick={() => {
                    setOrderOpen(true);
                    setOptionsOpen(false);
                  }}
                >
                  주문 프롬프트 열기
                </button>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            aria-label={orderOpen ? "주문 영역 접기" : "주문 영역 펼치기"}
            aria-expanded={orderOpen}
            onClick={() => setOrderOpen((v) => !v)}
            className={toolBtn(orderOpen)}
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition ${orderOpen ? "" : "-rotate-90"}`}
              aria-hidden
            />
          </button>
        </div>
      </div>

      {/* Full-width core: AI 배경 생성 */}
      <div className="w-full rounded-xl border border-slate-700 bg-[#0E1420] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 px-3 py-1.5">
          <p className="text-[12px] font-semibold text-slate-100 [word-break:keep-all]">
            {cs.bgGenerateTitle}
          </p>
          {contextHint ? (
            <p className="truncate text-[10px] text-slate-500">{contextHint}</p>
          ) : null}
        </div>

        <div className="flex items-end gap-2 p-2.5 sm:p-3">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label={cs.bgGenerateTitle}
            rows={3}
            readOnly={false}
            spellCheck={false}
            placeholder={cs.bgPlaceholder}
            className="min-h-[4.75rem] w-full flex-1 resize-none bg-transparent text-sm leading-relaxed text-slate-100 outline-none placeholder:text-slate-400"
          />
        </div>
        <p className="border-t border-slate-800/80 px-3 py-1.5 text-[10px] leading-snug text-slate-500">
          {cs.bgHint}
        </p>
      </div>

      <button
        type="button"
        disabled={!canSend}
        onClick={onGenerate}
        className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-3 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(99,102,241,0.28)] transition hover:bg-indigo-400 disabled:opacity-45"
      >
        {generating ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
        )}
        <span className="[word-break:keep-all]">
          {generating ? cs.bgGenerating : cs.bgGenerate}
        </span>
      </button>

      {orderOpen && expandedContent ? (
        <div className="rounded-xl border border-slate-800 bg-[#0E1420]/80 p-2.5">
          {expandedContent}
        </div>
      ) : null}
    </div>
  );
}
