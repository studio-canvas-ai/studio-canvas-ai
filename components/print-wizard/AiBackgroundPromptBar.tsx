"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  ChevronDown,
  Loader2,
  MoreHorizontal,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import {
  FIELD_CATEGORIES,
  type BgPresetId,
} from "@/lib/printWizardTypes";
import type { WizardProductId } from "@/lib/wizard/wizardProduct";
import { photoInpaintUi } from "@/lib/photoInpaintCopy";

export type SpecSettingsTagId = "format" | "style" | "use" | "prompt" | "bg";

export type AiBackgroundPromptBarProps = {
  value: string;
  generating?: boolean;
  bgPresetId?: BgPresetId | null;
  specTags?: { id: SpecSettingsTagId | "pages"; label: string; value: string }[];
  canGenerate?: boolean;
  onChange: (value: string) => void;
  onPresetPick: (id: BgPresetId) => void;
  onGenerate: () => void;
  onClearSpecTag?: (id: SpecSettingsTagId) => void;
  /** Optional order prompt shown when expanded. */
  expandedContent?: ReactNode;
  /** Photo lookbook uses subject-transform (inpaint) copy + hides field mood. */
  productId?: WizardProductId;
};

/**
 * Compact Adobe-inspired toolbar + full-width AI prompt (bg or inpaint).
 */
export default function AiBackgroundPromptBar({
  value,
  generating = false,
  bgPresetId = null,
  specTags = [],
  canGenerate = false,
  onChange,
  onPresetPick,
  onGenerate,
  expandedContent,
  productId = "print",
  onClearSpecTag,
}: AiBackgroundPromptBarProps) {
  const { t, locale } = useI18n();
  const cs = t.canvasStudio;
  const isPhoto = productId === "photo";
  const photoUi = isPhoto ? photoInpaintUi(locale) : null;
  const title = photoUi?.title ?? cs.bgGenerateTitle;
  const generateLabel = photoUi?.generate ?? cs.bgGenerate;
  const generatingLabel = photoUi?.generating ?? cs.bgGenerating;
  const placeholder = photoUi?.placeholder ?? cs.bgPlaceholder;
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

  const canSend = !generating && canGenerate;
  const showNeedOptionsHint = !isPhoto && !canGenerate && !generating;

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    if (canSend) onGenerate();
  };

  const toolBtn = (active: boolean) =>
    `inline-flex h-7 w-7 items-center justify-center rounded-full border transition ${
      active
        ? "border-indigo-400 bg-indigo-50 text-indigo-700"
        : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50"
    }`;

  return (
    <div ref={rootRef} className="relative w-full shrink-0 space-y-2">
      {/* Compact tool strip — petite, not dominant */}
      <div className="flex w-full items-center gap-1.5">
        {!isPhoto ? (
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
              <div className="absolute top-[calc(100%+6px)] left-0 z-30 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                <p className="mb-1.5 px-1 text-[10px] font-semibold tracking-wide text-slate-900 uppercase">
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
                            ? "border-indigo-400 bg-indigo-50 text-indigo-800"
                            : "border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300 hover:bg-white"
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
        ) : (
          <p className="max-w-[min(100%,28rem)] text-[10px] font-medium leading-snug text-slate-900 [word-break:keep-all]">
            {photoUi?.hint}
          </p>
        )}

        <div className="ml-auto flex items-center gap-1">
          <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-indigo-700">
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
              <div className="absolute top-[calc(100%+6px)] right-0 z-30 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-sm">
                <button
                  type="button"
                  className="block w-full px-2.5 py-1.5 text-left text-[11px] font-semibold text-slate-900 hover:bg-slate-50"
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
                  className="block w-full px-2.5 py-1.5 text-left text-[11px] font-semibold text-slate-900 hover:bg-slate-50"
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

      {/* Full-width core: AI prompt */}
      <div className="w-full rounded-xl border border-sky-200 bg-sky-50 shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-sky-200/80 px-3 py-1.5">
          <p className="text-[12px] font-semibold text-slate-900 [word-break:keep-all]">
            {title}
          </p>
        </div>

        <div className="relative p-2.5 sm:p-3">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label={title}
            rows={3}
            readOnly={false}
            spellCheck={false}
            aria-describedby="print-bg-guide"
            className="min-h-[4.75rem] w-full resize-none bg-sky-50 pb-6 text-sm leading-relaxed text-slate-900 outline-none"
          />
          <p
            id="print-bg-guide"
            className="pointer-events-none absolute inset-x-2.5 bottom-2 bg-gradient-to-t from-sky-50 from-60% to-transparent pt-3 text-[13px] font-semibold leading-none text-slate-900 sm:inset-x-3 sm:text-[14px]"
          >
            {placeholder}
          </p>
        </div>
        {specTags.length ? (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-sky-200/80 px-3 py-2">
            {specTags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-pink-200 bg-pink-50 py-1 pl-2.5 pr-1 text-[11px] font-semibold text-pink-800 [word-break:keep-all]"
              >
                <span className="text-pink-600">{tag.label}</span>
                <span className="truncate text-pink-900">{tag.value}</span>
                {onClearSpecTag && tag.id !== "pages" ? (
                  <button
                    type="button"
                    aria-label={`${tag.label} 선택 해제`}
                    onClick={() => onClearSpecTag(tag.id as SpecSettingsTagId)}
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-pink-700 transition hover:bg-pink-100 hover:text-pink-900"
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                ) : null}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div
        className={`group/gen relative w-full ${
          showNeedOptionsHint ? "cursor-not-allowed" : ""
        }`}
      >
        {showNeedOptionsHint ? (
          <div
            role="tooltip"
            id="ai-bg-need-options-hint"
            className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-40 w-[min(100%,20rem)] -translate-x-1/2 rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-center text-[12px] font-bold leading-snug text-slate-900 opacity-0 shadow-md [word-break:keep-all] group-hover/gen:opacity-100"
          >
            {cs.bgGenerateNeedAllOptions}
          </div>
        ) : null}
        <button
          type="button"
          disabled={!canSend}
          onClick={onGenerate}
          aria-describedby={
            showNeedOptionsHint ? "ai-bg-need-options-hint" : undefined
          }
          className={`inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-3 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(99,102,241,0.28)] transition hover:bg-indigo-400 disabled:opacity-45 ${
            showNeedOptionsHint
              ? "pointer-events-none cursor-not-allowed"
              : "disabled:cursor-not-allowed"
          }`}
        >
          {generating ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
          )}
          <span className="[word-break:keep-all]">
            {generating ? generatingLabel : generateLabel}
          </span>
        </button>
      </div>

      {orderOpen && expandedContent ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 shadow-sm">
          {expandedContent}
        </div>
      ) : null}
    </div>
  );
}
