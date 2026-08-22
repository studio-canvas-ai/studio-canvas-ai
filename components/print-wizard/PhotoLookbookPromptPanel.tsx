"use client";

import { useRef, type KeyboardEvent } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { photoInpaintUi } from "@/lib/photoInpaintCopy";

export type PhotoLookbookPromptPanelProps = {
  bgValue: string;
  subjectValue: string;
  generating?: boolean;
  generatingKind?: "background" | "subject" | null;
  specTags?: { label: string; value: string }[];
  canGenerateBackground?: boolean;
  canGenerateSubject?: boolean;
  onBgChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onGenerateBackground: () => void;
  onGenerateSubject: () => void;
};

/**
 * Two-tier lookbook prompts with persistent guide labels (never placeholders).
 * Explicit textarea heights — avoid flex-1 / grid 1fr / absolute fill.
 */
export default function PhotoLookbookPromptPanel({
  bgValue,
  subjectValue,
  generating = false,
  generatingKind = null,
  specTags = [],
  canGenerateBackground = false,
  canGenerateSubject = false,
  onBgChange,
  onSubjectChange,
  onGenerateBackground,
  onGenerateSubject,
}: PhotoLookbookPromptPanelProps) {
  const { locale } = useI18n();
  const ui = photoInpaintUi(locale);
  const bgRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLTextAreaElement>(null);

  const bgBusy = generating && generatingKind === "background";
  const subjectBusy = generating && generatingKind === "subject";
  const canSendBg = !generating && canGenerateBackground;
  const canSendSubject = !generating && canGenerateSubject;

  const onBgKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    if (canSendBg) onGenerateBackground();
  };

  const onSubjectKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    if (canSendSubject) onGenerateSubject();
  };

  const fieldShell =
    "w-full rounded-xl border border-slate-700 bg-[#0E1420] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]";
  const titleClass =
    "border-b border-slate-800/80 px-3 py-1.5 text-[12px] font-semibold text-slate-100 [word-break:keep-all]";
  const guideClass =
    "shrink-0 border-b border-slate-800/50 px-3 py-2 text-[13px] leading-snug text-gray-500 [word-break:keep-all]";
  const btnClass =
    "inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(99,102,241,0.28)] transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-45";
  const areaClass =
    "box-border block w-full resize-y bg-transparent px-3 py-2.5 text-sm leading-relaxed text-slate-100 outline-none";

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Tier 1 — Background */}
      <div className="flex flex-col gap-2">
        <div className={fieldShell}>
          <p className={titleClass}>{ui.bgTitle}</p>
          <p className={guideClass}>{ui.bgPlaceholder}</p>
          <textarea
            ref={bgRef}
            value={bgValue}
            onChange={(e) => onBgChange(e.target.value)}
            onKeyDown={onBgKeyDown}
            aria-label={ui.bgTitle}
            rows={5}
            spellCheck={false}
            className={areaClass}
            style={{ height: 148, minHeight: 148 }}
          />
          {specTags.length ? (
            <div className="flex flex-wrap items-center gap-1 border-t border-slate-800/80 px-2.5 py-1.5">
              {specTags.map((tag) => (
                <span
                  key={tag.label}
                  className="inline-flex max-w-full items-center gap-0.5 rounded-full border border-pink-400/40 bg-pink-500/10 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-pink-300 [word-break:keep-all]"
                >
                  <span className="text-pink-400/80">{tag.label}</span>
                  <span className="truncate text-pink-200">{tag.value}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          disabled={!canSendBg}
          onClick={onGenerateBackground}
          className={btnClass}
        >
          {bgBusy ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
          )}
          <span className="[word-break:keep-all]">
            {bgBusy ? ui.bgGenerating : ui.bgGenerate}
          </span>
        </button>
      </div>

      {/* Tier 2 — Subject */}
      <div className="flex flex-col gap-2">
        <div className={fieldShell}>
          <p className={titleClass}>{ui.subjectTitle}</p>
          <p className={guideClass}>{ui.subjectPlaceholder}</p>
          <textarea
            ref={subjectRef}
            value={subjectValue}
            onChange={(e) => onSubjectChange(e.target.value)}
            onKeyDown={onSubjectKeyDown}
            aria-label={ui.subjectTitle}
            rows={5}
            spellCheck={false}
            className={areaClass}
            style={{ height: 148, minHeight: 148 }}
          />
        </div>
        <button
          type="button"
          disabled={!canSendSubject}
          onClick={onGenerateSubject}
          className={btnClass}
        >
          {subjectBusy ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
          )}
          <span className="[word-break:keep-all]">
            {subjectBusy ? ui.subjectGenerating : ui.subjectGenerate}
          </span>
        </button>
      </div>
    </div>
  );
}
