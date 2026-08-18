"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { fillCanvas } from "@/lib/i18n";
import { ChevronDown } from "lucide-react";
import {
  FIELD_CATEGORIES,
  PRINT_FORMATS,
  PRINT_USES,
  PRINT_PAGE_COUNTS,
  PRINT_CUSTOM_SIZE_MAX_CM,
  PRINT_CUSTOM_SIZE_MAX_INCH,
  fieldById,
  type BgPresetId,
  type PrintCustomSize,
  type PrintCustomUnit,
  type PrintFormatId,
  type PrintUseId,
  type PrintPageCount,
} from "@/lib/printWizardTypes";
import {
  KEYWORD_TAG_CATEGORIES,
  appendKeywordTag,
  selectedKeywordTags,
  type KeywordTagCategoryId,
} from "@/lib/printWizardKeywordTags";
import ControlBarDropdown, {
  ControlMenuItem,
} from "@/components/print-wizard/ControlBarDropdown";
import AiBackgroundPromptBar from "@/components/print-wizard/AiBackgroundPromptBar";
import {
  IMAGE_STYLE_PRESETS,
  MOOD_STYLE_PRESETS,
  type VisualStyleSelection,
} from "@/lib/ai/visualStylePresets";

export type SpecSettingsPanelProps = {
  formatId: PrintFormatId;
  useId: PrintUseId;
  pageCount: PrintPageCount;
  customSize: PrintCustomSize | null;
  bgKeyword: string;
  bgPresetId: BgPresetId | null;
  selectedPromptPresetId: string | null;
  mainPrompt: string;
  visualStyle: VisualStyleSelection;
  generating?: boolean;
  onFormatChange: (id: PrintFormatId) => void;
  onCustomSizeApply: (size: PrintCustomSize) => void;
  onUseChange: (id: PrintUseId) => void;
  onPageCountChange: (count: PrintPageCount) => void;
  onBgKeywordChange: (keyword: string) => void;
  onBgPresetPick: (id: BgPresetId) => void;
  onGenerateBackground: () => void;
  onPromptPresetPick: (id: string, prompt: string) => void;
  onMainPromptChange: (value: string) => void;
  onVisualStyleChange: (next: VisualStyleSelection) => void;
};

type OpenKey = "format" | "style" | "use" | "pages" | "prompt" | "bg" | null;

const PRESET_FORMATS = PRINT_FORMATS.filter((f) => f.id !== "free");

function exampleCategoryLabel(
  id: KeywordTagCategoryId,
  cs: {
    tagCatBackground: string;
    tagCatMood: string;
    tagCatEvent: string;
    tagCatProduct: string;
  }
): string {
  if (id === "background") return cs.tagCatBackground;
  if (id === "mood") return cs.tagCatMood;
  if (id === "event") return cs.tagCatEvent;
  return cs.tagCatProduct;
}

/**
 * Center panel: compact option row + Adobe-inspired AI background prompt bar.
 */
export default function SpecSettingsPanel({
  formatId,
  useId,
  pageCount,
  customSize,
  bgKeyword,
  bgPresetId,
  selectedPromptPresetId: _selectedPromptPresetId,
  mainPrompt,
  visualStyle,
  generating = false,
  onFormatChange,
  onCustomSizeApply,
  onUseChange,
  onPageCountChange,
  onBgKeywordChange,
  onBgPresetPick,
  onGenerateBackground,
  onPromptPresetPick: _onPromptPresetPick,
  onMainPromptChange,
  onVisualStyleChange,
}: SpecSettingsPanelProps) {
  const { t } = useI18n();
  const cs = t.canvasStudio;
  const formatTitle = (id: string, fallback: string) =>
    id === "original"
      ? cs.formatOriginal
      : id === "free"
        ? cs.formatFree
        : fallback;
  const useTitle = (id: keyof typeof cs.uses, fallback: string) =>
    cs.uses[id] ?? fallback;
  const pageTitle = (value: number) =>
    value === 1
      ? cs.pageSingle
      : value === 2
        ? cs.pageDouble
        : fillCanvas(cs.pageN, { n: value });
  const styleValueLabel = [
    visualStyle.imageStyleId
      ? cs.imageStyles[
          visualStyle.imageStyleId as keyof typeof cs.imageStyles
        ]
      : null,
    visualStyle.moodStyleId
      ? cs.moodStyles[visualStyle.moodStyleId as keyof typeof cs.moodStyles]
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const [openKey, setOpenKey] = useState<OpenKey>(null);
  const [freeSizeOpen, setFreeSizeOpen] = useState(false);
  const [customUnit, setCustomUnit] = useState<PrintCustomUnit>(
    customSize?.unit ?? "cm"
  );
  const [widthInput, setWidthInput] = useState(
    String(customSize?.width ?? 21)
  );
  const [heightInput, setHeightInput] = useState(
    String(customSize?.height ?? 29.7)
  );
  const [sizeError, setSizeError] = useState<string | null>(null);
  const unitLabel = customUnit === "cm" ? "cm" : cs.inch;

  // Keep accordion closed whenever the 규격 menu re-opens.
  useEffect(() => {
    if (openKey !== "format") setFreeSizeOpen(false);
  }, [openKey]);

  useEffect(() => {
    if (!customSize) return;
    setCustomUnit(customSize.unit);
    setWidthInput(String(customSize.width));
    setHeightInput(String(customSize.height));
  }, [customSize]);

  const formatValueLabel =
    formatId === "free" && customSize
      ? `${customSize.width}×${customSize.height}${
          customSize.unit === "cm" ? "cm" : cs.inch
        }`
      : formatTitle(
          formatId,
          PRINT_FORMATS.find((f) => f.id === formatId)?.label ?? formatId
        );

  const applyFreeSize = () => {
    const width = Number(widthInput);
    const height = Number(heightInput);
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0
    ) {
      setSizeError("가로·세로 값을 올바르게 입력해 주세요.");
      return;
    }
    const maxPhysical =
      customUnit === "cm"
        ? PRINT_CUSTOM_SIZE_MAX_CM
        : PRINT_CUSTOM_SIZE_MAX_INCH;
    if (width > maxPhysical || height > maxPhysical) {
      setSizeError(
        `한 변은 최대 ${maxPhysical}${customUnit === "cm" ? "cm" : "인치"}까지 입력할 수 있습니다.`
      );
      return;
    }
    setSizeError(null);
    onCustomSizeApply({ unit: customUnit, width, height });
    setOpenKey(null);
    setFreeSizeOpen(false);
  };

  const pickedExampleTags = selectedKeywordTags(bgKeyword);

  return (
    <section className="flex h-full min-h-0 flex-col gap-3 overflow-hidden rounded-2xl border border-slate-800 bg-[#121824] p-3 shadow-[0_8px_32px_rgba(0,0,0,0.35)] sm:p-4">
      {/* 규격 · 스타일 · 용도 · 장수 · 예시 · 분야 — single compact row */}
      <div data-spec-row className="flex shrink-0 flex-row items-center gap-1.5">
        <ControlBarDropdown
          compact
          label={cs.specFormat}
          value={formatValueLabel}
          open={openKey === "format"}
          onOpenChange={(v) => setOpenKey(v ? "format" : null)}
          menuMinWidth={320}
          menuMaxWidth={380}
        >
          <div className="grid grid-cols-2 gap-1">
            {PRESET_FORMATS.map((fmt) => (
              <ControlMenuItem
                key={fmt.id}
                active={formatId === fmt.id}
                title={formatTitle(fmt.id, fmt.label)}
                onClick={() => {
                  onFormatChange(fmt.id);
                  setOpenKey(null);
                }}
              />
            ))}
          </div>

          <div className="mt-1.5 border-t border-slate-800 pt-1.5">
            <button
              type="button"
              onClick={() => {
                setFreeSizeOpen((v) => !v);
                setSizeError(null);
              }}
              className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left text-[12px] font-semibold transition ${
                formatId === "free" || freeSizeOpen
                  ? "border-indigo-400/40 bg-indigo-500/15 text-slate-50"
                  : "border-slate-700/80 bg-[#0E1420] text-slate-200 hover:border-slate-600 hover:bg-slate-800/60"
              }`}
            >
              <span className="[word-break:keep-all]">
                {cs.customSize}
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${
                  freeSizeOpen ? "rotate-180" : ""
                }`}
                aria-hidden
              />
            </button>

            <div
              className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                freeSizeOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="mt-2 space-y-2.5 rounded-xl border border-slate-700/70 bg-[#0B0F19] p-2.5">
                  <div className="flex overflow-hidden rounded-lg border border-slate-700">
                    {(
                      [
                        { id: "cm", label: "CM" },
                        { id: "inch", label: cs.inch },
                      ] as const
                    ).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setCustomUnit(u.id)}
                        className={`flex-1 py-1.5 text-[11px] font-semibold transition ${
                          customUnit === u.id
                            ? "bg-slate-100 text-slate-900"
                            : "bg-transparent text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {u.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className="text-[10px] text-slate-500">
                        {cs.width} ({unitLabel})
                      </span>
                      <input
                        type="number"
                        min={0.1}
                        step={0.1}
                        value={widthInput}
                        onChange={(e) => {
                          setWidthInput(e.target.value);
                          setSizeError(null);
                        }}
                        className="w-full rounded-lg border border-slate-700 bg-[#121824] px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] text-slate-500">
                        {cs.height} ({unitLabel})
                      </span>
                      <input
                        type="number"
                        min={0.1}
                        step={0.1}
                        value={heightInput}
                        onChange={(e) => {
                          setHeightInput(e.target.value);
                          setSizeError(null);
                        }}
                        className="w-full rounded-lg border border-slate-700 bg-[#121824] px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </label>
                  </div>

                  <p className="text-[10px] leading-relaxed text-slate-500">
                    최대 {PRINT_CUSTOM_SIZE_MAX_CM}cm /{" "}
                    {PRINT_CUSTOM_SIZE_MAX_INCH}인치
                  </p>

                  {sizeError ? (
                    <p className="text-[11px] font-medium text-rose-300">
                      {sizeError}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    onClick={applyFreeSize}
                    className="w-full rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
                  >
                    {cs.apply}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ControlBarDropdown>

        <ControlBarDropdown
          compact
          label={cs.specStyle}
          value={styleValueLabel || undefined}
          open={openKey === "style"}
          onOpenChange={(v) => setOpenKey(v ? "style" : null)}
          menuMinWidth={300}
          menuMaxWidth={360}
        >
          <div className="space-y-2.5">
            <div>
              <p className="mb-1 px-0.5 text-[10px] font-semibold tracking-wide text-slate-500">
                {cs.imageStyle}
              </p>
              <div className="grid grid-cols-1 gap-1">
                {IMAGE_STYLE_PRESETS.map((preset) => {
                  const active = visualStyle.imageStyleId === preset.id;
                  return (
                    <ControlMenuItem
                      key={preset.id}
                      active={active}
                      title={
                        cs.imageStyles[
                          preset.id as keyof typeof cs.imageStyles
                        ]
                      }
                      onClick={() => {
                        onVisualStyleChange({
                          ...visualStyle,
                          imageStyleId: active ? null : preset.id,
                        });
                      }}
                    />
                  );
                })}
              </div>
            </div>
            <div className="border-t border-slate-800 pt-2">
              <p className="mb-1 px-0.5 text-[10px] font-semibold tracking-wide text-slate-500">
                {cs.moodStyle}
              </p>
              <div className="grid grid-cols-1 gap-1">
                {MOOD_STYLE_PRESETS.map((preset) => {
                  const active = visualStyle.moodStyleId === preset.id;
                  return (
                    <ControlMenuItem
                      key={preset.id}
                      active={active}
                      title={
                        cs.moodStyles[
                          preset.id as keyof typeof cs.moodStyles
                        ]
                      }
                      onClick={() => {
                        onVisualStyleChange({
                          ...visualStyle,
                          moodStyleId: active ? null : preset.id,
                        });
                      }}
                    />
                  );
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onVisualStyleChange({
                  imageStyleId: null,
                  moodStyleId: null,
                });
                setOpenKey(null);
              }}
              className="w-full rounded-lg border border-slate-700/80 bg-[#0E1420] px-2.5 py-2 text-[11px] font-semibold text-slate-400 hover:border-slate-600 hover:text-slate-200"
            >
              {cs.styleReset}
            </button>
          </div>
        </ControlBarDropdown>

        <ControlBarDropdown
          compact
          label={cs.specUse}
          value={useTitle(useId, PRINT_USES.find((u) => u.id === useId)?.label ?? useId)}
          open={openKey === "use"}
          onOpenChange={(v) => setOpenKey(v ? "use" : null)}
          menuMinWidth={300}
          menuMaxWidth={360}
        >
          <div className="grid grid-cols-2 gap-1">
            {PRINT_USES.map((item) => (
              <ControlMenuItem
                key={item.id}
                active={useId === item.id}
                title={useTitle(item.id, item.label)}
                onClick={() => {
                  onUseChange(item.id);
                  setOpenKey(null);
                }}
              />
            ))}
          </div>
        </ControlBarDropdown>

        <ControlBarDropdown
          compact
          label={cs.specPages}
          value={pageTitle(pageCount)}
          open={openKey === "pages"}
          onOpenChange={(v) => setOpenKey(v ? "pages" : null)}
          menuMinWidth={180}
          menuMaxWidth={220}
        >
          {PRINT_PAGE_COUNTS.map((item) => (
            <ControlMenuItem
              key={item.value}
              active={pageCount === item.value}
              title={pageTitle(item.value)}
              onClick={() => {
                onPageCountChange(item.value);
                setOpenKey(null);
              }}
            />
          ))}
        </ControlBarDropdown>

        <ControlBarDropdown
          compact
          label={cs.specExample}
          open={openKey === "prompt"}
          onOpenChange={(v) => setOpenKey(v ? "prompt" : null)}
          menuMinWidth={640}
          menuMaxWidth={920}
          menuAnchorSelector="[data-spec-row]"
        >
          <div className="flex flex-col gap-2.5 p-2 sm:p-2.5">
            {KEYWORD_TAG_CATEGORIES.map((group) => (
              <div
                key={group.id}
                className="flex flex-col gap-1.5 sm:flex-row sm:items-start"
              >
                <p className="w-[7.5rem] shrink-0 pt-1 text-[11px] font-bold tracking-wide text-indigo-200/90 [word-break:keep-all]">
                  {exampleCategoryLabel(group.id, cs)}
                </p>
                <div className="flex min-w-0 flex-1 flex-row flex-wrap gap-1.5">
                  {group.tags.map((tag) => {
                    const on = pickedExampleTags.has(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          onBgKeywordChange(appendKeywordTag(bgKeyword, tag));
                        }}
                        className={`rounded-full border px-2.5 py-1.5 text-[11px] font-semibold [word-break:keep-all] transition pointer-coarse:min-h-9 pointer-coarse:px-3 ${
                          on
                            ? "border-indigo-400/50 bg-indigo-500/20 text-indigo-100"
                            : "border-slate-700 bg-[#0E1420] text-slate-300 hover:border-slate-500 hover:text-white"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ControlBarDropdown>

        <ControlBarDropdown
          compact
          label={cs.specBg}
          value={
            bgPresetId
              ? cs.bgPresets[bgPresetId] ?? fieldById(bgPresetId)?.label
              : undefined
          }
          open={openKey === "bg"}
          onOpenChange={(v) => setOpenKey(v ? "bg" : null)}
          menuMinWidth={640}
          menuMaxWidth={920}
          menuAnchorSelector="[data-spec-row]"
        >
          <div className="flex flex-col gap-2.5 p-2 sm:p-2.5">
            {FIELD_CATEGORIES.map((group) => (
              <div
                key={group.id}
                className="flex flex-col gap-1.5 sm:flex-row sm:items-start"
              >
                <p className="w-[7.5rem] shrink-0 pt-1 text-[11px] font-bold tracking-wide text-indigo-200/90 [word-break:keep-all]">
                  {cs.fieldGroups[group.id]}
                </p>
                <div className="flex min-w-0 flex-1 flex-row flex-wrap gap-1.5">
                  {group.items.map((item) => {
                    const on = bgPresetId === item.id;
                    const title = cs.bgPresets[item.id] ?? item.label;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onBgPresetPick(item.id as BgPresetId);
                          setOpenKey(null);
                        }}
                        className={`rounded-full border px-2.5 py-1.5 text-[11px] font-semibold [word-break:keep-all] transition pointer-coarse:min-h-9 pointer-coarse:px-3 ${
                          on
                            ? "border-indigo-400/50 bg-indigo-500/20 text-indigo-100"
                            : "border-slate-700 bg-[#0E1420] text-slate-300 hover:border-slate-500 hover:text-white"
                        }`}
                      >
                        {title}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ControlBarDropdown>
      </div>

      {/* Compact tools + full-width AI 배경 생성 */}
      <AiBackgroundPromptBar
        value={bgKeyword}
        generating={generating}
        bgPresetId={bgPresetId}
        contextHint={`${formatValueLabel ?? ""} · ${useTitle(
          useId,
          PRINT_USES.find((u) => u.id === useId)?.label ?? useId
        )} · ${pageTitle(pageCount)}`}
        onChange={onBgKeywordChange}
        onPresetPick={onBgPresetPick}
        onGenerate={onGenerateBackground}
        expandedContent={
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-slate-500">
              주문 / 초안 프롬프트
            </p>
            <textarea
              value={mainPrompt}
              onChange={(e) => onMainPromptChange(e.target.value)}
              aria-label="메인 프롬프트 / 주문 내용"
              rows={2}
              placeholder="예시에서 선택하거나 주문 내용을 입력하세요."
              className="min-h-[3.5rem] w-full resize-none rounded-lg border border-slate-700 bg-[#0B0F19] px-2.5 py-1.5 text-sm leading-relaxed text-slate-100 outline-none placeholder:text-slate-600 focus:border-slate-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        }
      />

      {/* Reserved empty space for future tools */}
      <div className="min-h-0 flex-1" aria-hidden />
    </section>
  );
}
