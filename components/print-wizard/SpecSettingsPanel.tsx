"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { fillCanvas } from "@/lib/i18n";
import { ChevronDown } from "lucide-react";
import {
  FIELD_CATEGORIES,
  PRINT_FORMATS,
  PHOTO_FORMATS,
  PRINT_USES,
  PHOTO_USES,
  PRINT_PAGE_COUNTS,
  PRINT_CUSTOM_SIZE_MAX_CM,
  PRINT_CUSTOM_SIZE_MAX_INCH,
  fieldById,
  emptySpecPicks,
  type BgPresetId,
  type PrintCustomSize,
  type PrintCustomUnit,
  type PrintFormatId,
  type PrintUseId,
  type PrintPageCount,
  type PrintWizardSpecPicks,
} from "@/lib/printWizardTypes";
import type { WizardProductId } from "@/lib/wizard/wizardProduct";
import {
  applyBgExamplePreset,
  BG_EXAMPLE_CATEGORIES,
  findSelectedBgExamplePreset,
  isBgExamplePresetSelected,
} from "@/lib/aiBackgroundExamplePresets";
import {
  PHOTO_LOOKBOOK_EXAMPLE_HINT,
  getPhotoLookbookExampleCategories,
} from "@/lib/photoLookbookExamples";
import ControlBarDropdown, {
  ControlMenuItem,
} from "@/components/print-wizard/ControlBarDropdown";
import AiBackgroundPromptBar from "@/components/print-wizard/AiBackgroundPromptBar";
import PhotoLookbookPromptPanel from "@/components/print-wizard/PhotoLookbookPromptPanel";
import {
  IMAGE_STYLE_PRESETS,
  type VisualStyleSelection,
} from "@/lib/ai/visualStylePresets";

export type SpecSettingsPanelProps = {
  formatId: PrintFormatId;
  useId: PrintUseId;
  pageCount: PrintPageCount;
  customSize: PrintCustomSize | null;
  specPicks?: PrintWizardSpecPicks;
  bgKeyword: string;
  bgPresetId: BgPresetId | null;
  selectedPromptPresetId: string | null;
  mainPrompt: string;
  visualStyle: VisualStyleSelection;
  generating?: boolean;
  /** Photo: which generate action is running. */
  generatingKind?: "background" | "subject" | null;
  /** Photo wizard shows the short pictorial use list only. */
  productId?: WizardProductId;
  /** Screen 26: expand to content height (no inner scrollbar / clipped CTA). */
  fitContent?: boolean;
  onFormatChange: (id: PrintFormatId) => void;
  onCustomSizeApply: (size: PrintCustomSize) => void;
  onUseChange: (id: PrintUseId) => void;
  onPageCountChange: (count: PrintPageCount) => void;
  onBgKeywordChange: (keyword: string) => void;
  onBgPresetPick: (id: BgPresetId) => void;
  onGenerateBackground: () => void;
  /** Photo: dedicated subject-edit generate. */
  onGenerateSubject?: () => void;
  onPromptPresetPick: (id: string, prompt: string) => void;
  onMainPromptChange: (value: string) => void;
  onVisualStyleChange: (next: VisualStyleSelection) => void;
};

type OpenKey = "format" | "style" | "use" | "pages" | "prompt" | "bg" | null;

const PRINT_PRESET_FORMATS = PRINT_FORMATS.filter((f) => f.id !== "free");
const PHOTO_PRESET_FORMATS = PHOTO_FORMATS.filter((f) => f.id !== "free");

/**
 * Center panel: compact option row + Adobe-inspired AI background prompt bar.
 */
export default function SpecSettingsPanel({
  formatId,
  useId,
  pageCount,
  customSize,
  specPicks: specPicksProp,
  bgKeyword,
  bgPresetId,
  selectedPromptPresetId: _selectedPromptPresetId,
  mainPrompt,
  visualStyle,
  generating = false,
  generatingKind = null,
  productId = "print",
  fitContent = false,
  onFormatChange,
  onCustomSizeApply,
  onUseChange,
  onPageCountChange,
  onBgKeywordChange,
  onBgPresetPick,
  onGenerateBackground,
  onGenerateSubject,
  onPromptPresetPick: _onPromptPresetPick,
  onMainPromptChange,
  onVisualStyleChange,
}: SpecSettingsPanelProps) {
  const { t, locale } = useI18n();
  const cs = t.canvasStudio;
  const formatTitle = (id: string, fallback: string) =>
    id === "original"
      ? cs.formatOriginal
      : id === "free"
        ? cs.formatFree
        : fallback;
  const useTitle = (id: keyof typeof cs.uses, fallback: string) =>
    cs.uses[id] ?? fallback;
  const isPhotoProduct = productId === "photo";
  const useCatalog = isPhotoProduct ? PHOTO_USES : PRINT_USES;
  const presetFormats = isPhotoProduct
    ? PHOTO_PRESET_FORMATS
    : PRINT_PRESET_FORMATS;
  const resolveUseLabel = (id: PrintUseId | string, fallback: string) => {
    if (isPhotoProduct && id === "sns") {
      return cs.uses["profile-sns"] ?? fallback;
    }
    return useTitle(id as keyof typeof cs.uses, fallback);
  };
  const pageTitle = (value: number) =>
    value === 1
      ? cs.pageSingle
      : value === 2
        ? cs.pageDouble
        : fillCanvas(cs.pageN, { n: value });
  const styleValueLabel = visualStyle.imageStyleId
    ? cs.imageStyles[
        visualStyle.imageStyleId as keyof typeof cs.imageStyles
      ] ??
      IMAGE_STYLE_PRESETS.find((p) => p.id === visualStyle.imageStyleId)?.[
        locale === "kr" ? "labelKo" : "labelEn"
      ] ??
      ""
    : "";
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

  const specPicks = specPicksProp ?? emptySpecPicks();
  const selectedBgExample = findSelectedBgExamplePreset(bgKeyword);
  const selectedPhotoExample = isPhotoProduct
    ? getPhotoLookbookExampleCategories({
        useId,
        imageStyleId: visualStyle.imageStyleId,
      })
        .flatMap((c) => [...c.examples])
        .find((ex) => ex === bgKeyword.trim()) ?? null
    : null;
  const useValueLabel = resolveUseLabel(
    useId,
    useCatalog.find((u) => u.id === useId)?.label ??
      PRINT_USES.find((u) => u.id === useId)?.label ??
      useId
  );
  const pageValueLabel = pageTitle(pageCount);
  const fieldValueLabel = bgPresetId
    ? cs.bgPresets[bgPresetId] ?? fieldById(bgPresetId)?.label
    : "";
  const exampleValueLabel = isPhotoProduct
    ? selectedPhotoExample
      ? selectedPhotoExample.length > 22
        ? `${selectedPhotoExample.slice(0, 22)}…`
        : selectedPhotoExample
      : bgKeyword.trim()
        ? bgKeyword.trim().length > 22
          ? `${bgKeyword.trim().slice(0, 22)}…`
          : bgKeyword.trim()
        : ""
    : selectedBgExample
      ? selectedBgExample.labelKo.length > 22
        ? `${selectedBgExample.labelKo.slice(0, 22)}…`
        : selectedBgExample.labelKo
      : bgKeyword.trim()
        ? bgKeyword.trim().length > 22
          ? `${bgKeyword.trim().slice(0, 22)}…`
          : bgKeyword.trim()
        : "";
  const specTags = [
    specPicks.format && formatValueLabel
      ? { label: cs.specFormat, value: formatValueLabel }
      : null,
    specPicks.style && styleValueLabel
      ? { label: cs.specStyle, value: styleValueLabel }
      : null,
    specPicks.use && useValueLabel
      ? { label: cs.specUse, value: useValueLabel }
      : null,
    !isPhotoProduct && specPicks.pages && pageValueLabel
      ? { label: cs.specPages, value: pageValueLabel }
      : null,
    exampleValueLabel
      ? { label: cs.specExample, value: exampleValueLabel }
      : null,
    !isPhotoProduct && fieldValueLabel
      ? { label: cs.specBg, value: fieldValueLabel }
      : null,
  ].filter((tag): tag is { label: string; value: string } => Boolean(tag));
  const canGenerateBackground = isPhotoProduct
    ? specPicks.format &&
      specPicks.style &&
      specPicks.use &&
      bgKeyword.trim().length > 0
    : specPicks.format &&
      specPicks.style &&
      specPicks.use &&
      specPicks.pages &&
      Boolean(bgPresetId) &&
      bgKeyword.trim().length > 0;
  const canGenerateSubject = Boolean(
    isPhotoProduct &&
      specPicks.format &&
      specPicks.style &&
      specPicks.use &&
      mainPrompt.trim().length > 0
  );

  return (
    <section
      className={
        fitContent
          ? "flex w-full flex-col gap-2.5 overflow-visible rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-3.5"
          : "flex h-full min-h-0 flex-col gap-2.5 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-3.5"
      }
    >
      {/* 규격 · 스타일 · 용도 · (인쇄: 장수) · 배경 · (인쇄: 분야) */}
      <div
        data-spec-row
        className={`flex shrink-0 flex-row items-center ${
          isPhotoProduct ? "gap-2" : "gap-1.5"
        }`}
      >
        <ControlBarDropdown
          compact
          label={cs.specFormat}
          value={specPicks.format ? formatValueLabel : undefined}
          open={openKey === "format"}
          onOpenChange={(v) => setOpenKey(v ? "format" : null)}
          menuMinWidth={320}
          menuMaxWidth={380}
        >
          <div className="grid grid-cols-2 gap-1">
            {presetFormats.map((fmt) => (
              <ControlMenuItem
                key={fmt.id}
                active={specPicks.format && formatId === fmt.id}
                title={formatTitle(fmt.id, fmt.label)}
                onClick={() => {
                  onFormatChange(fmt.id);
                  setOpenKey(null);
                }}
              />
            ))}
          </div>

          <div className="mt-1.5 border-t border-slate-200 pt-1.5">
            <button
              type="button"
              onClick={() => {
                setFreeSizeOpen((v) => !v);
                setSizeError(null);
              }}
              className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left text-[12px] font-semibold transition ${
                (specPicks.format && formatId === "free") || freeSizeOpen
                  ? "border-indigo-400 bg-indigo-50 text-indigo-900"
                  : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span className="[word-break:keep-all]">
                {cs.customSize}
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 text-slate-900 transition-transform ${
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
                <div className="mt-2 space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                  <div className="flex overflow-hidden rounded-lg border border-slate-200">
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
                            ? "bg-slate-800 text-white"
                            : "bg-white font-semibold text-slate-900 hover:bg-slate-50"
                        }`}
                      >
                        {u.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className="text-[10px] font-semibold text-slate-900">
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
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] font-semibold text-slate-900">
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
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </label>
                  </div>

                  <p className="text-[10px] font-medium leading-relaxed text-slate-900">
                    최대 {PRINT_CUSTOM_SIZE_MAX_CM}cm /{" "}
                    {PRINT_CUSTOM_SIZE_MAX_INCH}인치
                  </p>

                  {sizeError ? (
                    <p className="text-[11px] font-medium text-rose-600">
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
          value={specPicks.style ? styleValueLabel || undefined : undefined}
          open={openKey === "style"}
          onOpenChange={(v) => setOpenKey(v ? "style" : null)}
          menuMinWidth={400}
          menuMaxWidth={480}
        >
          <div className="flex flex-col gap-0.5">
            {IMAGE_STYLE_PRESETS.map((preset) => {
              const active = visualStyle.imageStyleId === preset.id;
              const name =
                cs.imageStyles[
                  preset.id as keyof typeof cs.imageStyles
                ] ??
                (locale === "kr" ? preset.labelKo : preset.labelEn);
              const hint = locale === "kr" ? preset.hintKo : preset.hintEn;
              return (
                <ControlMenuItem
                  key={preset.id}
                  active={active}
                  oneLine
                  title={name}
                  hint={hint}
                  onClick={() => {
                    onVisualStyleChange({
                      imageStyleId: active ? null : preset.id,
                      moodStyleId: null,
                    });
                    setOpenKey(null);
                  }}
                />
              );
            })}
            <button
              type="button"
              onClick={() => {
                onVisualStyleChange({
                  imageStyleId: null,
                  moodStyleId: null,
                });
                setOpenKey(null);
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-900 hover:border-slate-300 hover:bg-slate-50"
            >
              {cs.styleReset}
            </button>
          </div>
        </ControlBarDropdown>

        <ControlBarDropdown
          compact
          label={cs.specUse}
          value={specPicks.use ? useValueLabel : undefined}
          open={openKey === "use"}
          onOpenChange={(v) => setOpenKey(v ? "use" : null)}
          menuMinWidth={isPhotoProduct ? 220 : 300}
          menuMaxWidth={isPhotoProduct ? 280 : 360}
        >
          <div
            className={
              isPhotoProduct
                ? "flex flex-col gap-0.5"
                : "grid grid-cols-2 gap-1"
            }
          >
            {useCatalog.map((item) => (
              <ControlMenuItem
                key={item.id}
                active={specPicks.use && useId === item.id}
                title={resolveUseLabel(item.id, item.label)}
                onClick={() => {
                  onUseChange(item.id);
                  setOpenKey(null);
                }}
              />
            ))}
          </div>
        </ControlBarDropdown>

        {!isPhotoProduct ? (
          <ControlBarDropdown
            compact
            label={cs.specPages}
            value={specPicks.pages ? pageValueLabel : undefined}
            open={openKey === "pages"}
            onOpenChange={(v) => setOpenKey(v ? "pages" : null)}
            menuMinWidth={180}
            menuMaxWidth={220}
          >
            {PRINT_PAGE_COUNTS.map((item) => (
              <ControlMenuItem
                key={item.value}
                active={specPicks.pages && pageCount === item.value}
                title={pageTitle(item.value)}
                onClick={() => {
                  onPageCountChange(item.value);
                  setOpenKey(null);
                }}
              />
            ))}
          </ControlBarDropdown>
        ) : null}

        <ControlBarDropdown
          compact
          label={cs.specExample}
          value={exampleValueLabel || undefined}
          open={openKey === "prompt"}
          onOpenChange={(v) => setOpenKey(v ? "prompt" : null)}
          menuMinWidth={isPhotoProduct ? 320 : 280}
          menuMaxWidth={isPhotoProduct ? 520 : 640}
          menuAnchorSelector="[data-spec-row]"
        >
          {isPhotoProduct ? (
            <div className="flex max-h-[min(70vh,32rem)] flex-col gap-3 overflow-y-auto p-2.5 sm:p-3">
              <p className="shrink-0 text-[12px] font-bold leading-snug text-red-500 [word-break:keep-all]">
                {PHOTO_LOOKBOOK_EXAMPLE_HINT}
              </p>
              {getPhotoLookbookExampleCategories({
                useId,
                imageStyleId: visualStyle.imageStyleId,
              }).map((group) => (
                <div key={group.id} className="flex flex-col gap-1.5">
                  <p className="text-[11px] font-bold tracking-wide text-slate-900 [word-break:keep-all]">
                    {group.label}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {group.examples.map((example) => {
                      const on = bgKeyword.trim() === example;
                      return (
                        <button
                          key={example}
                          type="button"
                          onClick={() => {
                            onBgKeywordChange(example);
                            setOpenKey(null);
                          }}
                          className={`rounded-lg border px-2.5 py-2 text-left text-[11px] font-medium leading-snug [word-break:keep-all] transition pointer-coarse:min-h-10 ${
                            on
                              ? "border-indigo-500 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-400/60"
                              : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          {example}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="max-h-[min(60vh,28rem)] overflow-y-auto overscroll-contain p-2 sm:p-2.5">
              {BG_EXAMPLE_CATEGORIES.map((group) => (
                <div key={group.id} className="mb-3 last:mb-0">
                  <p className="mb-2 text-[16px] font-bold tracking-wide text-slate-900 sm:text-[17px] [word-break:keep-all]">
                    {group.labelKo}
                  </p>
                  <div className="flex flex-row flex-wrap gap-1.5">
                    {group.presets.map((preset) => {
                      const on = isBgExamplePresetSelected(
                        bgKeyword,
                        preset.promptEn
                      );
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            onBgKeywordChange(
                              applyBgExamplePreset(preset.promptEn)
                            );
                          }}
                          className={`min-w-[9.5rem] flex-[1_1_45%] rounded-lg text-left shadow-sm transition [word-break:keep-all] ${
                            on
                              ? "border-[3px] border-indigo-500 bg-indigo-50 px-[5px] py-[2px] shadow-md ring-2 ring-indigo-400/60"
                              : "border border-gray-200 bg-white px-2 py-1 hover:border-gray-300 hover:shadow"
                          }`}
                        >
                          <span className="line-clamp-2 block text-[14px] font-bold leading-[1.2] text-black sm:text-[15px]">
                            {preset.titleKo}
                          </span>
                          <span className="mt-0.5 line-clamp-1 block text-[13px] font-semibold leading-[1.2] text-blue-700 sm:text-[14px]">
                            ({preset.hintKo})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ControlBarDropdown>

        {!isPhotoProduct ? (
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
            menuMinWidth={280}
            menuMaxWidth={640}
            menuAnchorSelector="[data-spec-row]"
          >
            <div className="max-h-[min(60vh,28rem)] overflow-y-auto overscroll-contain p-2 sm:p-2.5">
              {FIELD_CATEGORIES.map((group) => (
                <div key={group.id} className="mb-3 last:mb-0">
                  <p className="mb-2 text-[16px] font-bold tracking-wide text-slate-900 sm:text-[17px] [word-break:keep-all]">
                    {cs.fieldGroups[group.id]}
                  </p>
                  <div className="flex flex-row flex-wrap gap-1.5">
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
                          className={`min-w-[9.5rem] flex-[1_1_45%] rounded-lg text-left shadow-sm transition [word-break:keep-all] pointer-coarse:min-h-10 ${
                            on
                              ? "border-[3px] border-indigo-500 bg-indigo-50 px-[5px] py-[2px] shadow-md ring-2 ring-indigo-400/60"
                              : "border border-gray-200 bg-white px-2 py-1 hover:border-indigo-300 hover:shadow"
                          }`}
                        >
                          <span className="line-clamp-2 block text-[14px] font-bold leading-[1.2] text-black sm:text-[15px]">
                            {title}
                          </span>
                          <span className="mt-0.5 line-clamp-1 block text-[13px] font-semibold leading-[1.2] text-blue-700 sm:text-[14px]">
                            ({item.hint})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ControlBarDropdown>
        ) : null}
      </div>

      {/* Photo: two-tier prompts. Print: single Adobe-style bar. */}
      {isPhotoProduct ? (
        <div className="flex w-full shrink-0 flex-col">
          <PhotoLookbookPromptPanel
            bgValue={bgKeyword}
            subjectValue={mainPrompt}
            generating={generating}
            generatingKind={generatingKind}
            specTags={specTags}
            canGenerateBackground={Boolean(canGenerateBackground)}
            canGenerateSubject={canGenerateSubject}
            onBgChange={onBgKeywordChange}
            onSubjectChange={onMainPromptChange}
            onGenerateBackground={onGenerateBackground}
            onGenerateSubject={() => onGenerateSubject?.()}
          />
        </div>
      ) : (
        <AiBackgroundPromptBar
          productId={productId}
          value={bgKeyword}
          generating={generating}
          bgPresetId={bgPresetId}
          specTags={specTags}
          canGenerate={canGenerateBackground}
          onChange={onBgKeywordChange}
          onPresetPick={onBgPresetPick}
          onGenerate={onGenerateBackground}
          expandedContent={
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-slate-900">
                주문 / 초안 프롬프트
              </p>
              <textarea
                value={mainPrompt}
                onChange={(e) => onMainPromptChange(e.target.value)}
                aria-label="메인 프롬프트 / 주문 내용"
                rows={2}
                placeholder="예시에서 선택하거나 주문 내용을 입력하세요."
                className="min-h-[3.5rem] w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm leading-relaxed text-slate-900 outline-none placeholder:text-slate-700 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          }
        />
      )}

      {/* Reserved empty space for future tools */}
      <div className="min-h-0 flex-1" aria-hidden />
    </section>
  );
}
