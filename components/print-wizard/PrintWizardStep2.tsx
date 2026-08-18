"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useI18n } from "@/components/I18nProvider";
import Step2Layout from "@/components/print-wizard/Step2Layout";
import PreviewCanvas from "@/components/print-wizard/PreviewCanvas";
import SpecSettingsPanel from "@/components/print-wizard/SpecSettingsPanel";
import SmartInputForm from "@/components/print-wizard/SmartInputForm";
import PageLayerEditModal from "@/components/print-wizard/PageLayerEditModal";
import { generatePrintBackgroundPages } from "@/lib/printWizardBg";
import {
  readPrintWizardSession,
  savePrintWizardSession,
} from "@/lib/printWizardSession";
import {
  addPageTextLayer,
  duplicateTextLayer,
  editorSlotCount,
  EDITOR_PAGE_SLOTS,
  patchGlobalInputsFromPage,
  removeTextLayer,
  resizeIndependentPages,
} from "@/lib/printWizardTextLayers";
import { mergeInvitationBlueprint } from "@/lib/printWizardBlueprint";
import {
  applyAutoLayoutState,
} from "@/lib/ai/autoLayoutEngine";
import { buildUnifiedPrintAiContext } from "@/lib/printWizardAiContext";
import type { TextLayer } from "@/lib/thumbnailStyles";
import {
  fieldById,
  formatById,
  resolvePrintAspect,
  useById,
  defaultPrintWizardState,
  type BgPresetId,
  type PrintCustomSize,
  type PrintFormatId,
  type PrintUseId,
  type PrintPageCount,
  type PrintWizardState,
} from "@/lib/printWizardTypes";

const PrintWizardEditStage = dynamic(
  () => import("@/components/print-wizard/PrintWizardEditStage"),
  { ssr: false }
);

export type PrintWizardNavState = {
  step: 1 | 2;
  onBack?: () => void;
};

export type PrintWizardStep2Props = {
  onNavChange?: (nav: PrintWizardNavState) => void;
};

/**
 * Print Smart Form — 2-step wizard orchestrator.
 * Step 1: specs + AI background + detail content input.
 * Step 2: canvas + Template Studio edit panel.
 */
export default function PrintWizardStep2({ onNavChange }: PrintWizardStep2Props) {
  const { t } = useI18n();
  const cs = t.canvasStudio;
  const [state, setState] = useState<PrintWizardState>(defaultPrintWizardState);
  const [generating, setGenerating] = useState(false);
  const [draftBusy, setDraftBusy] = useState(false);
  const [finishBusy, setFinishBusy] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTextLayerId, setActiveTextLayerId] = useState<string | null>(
    null
  );

  const [layerModalPage, setLayerModalPage] = useState<number | null>(null);

  const textLayersByPage = useMemo(() => {
    return resizeIndependentPages(
      state.textLayersByPage,
      editorSlotCount(state.pageCount)
    );
  }, [state.textLayersByPage, state.pageCount]);

  const editorPage = layerModalPage ?? currentPage;
  const editorPageIndex = Math.max(0, editorPage - 1);
  const editorPageLayers = textLayersByPage[editorPageIndex] ?? [];

  useEffect(() => {
    const saved = readPrintWizardSession();
    if (saved) {
      const next = applyAutoLayoutState(
        { ...saved, wizardStep: 1 as const },
        {}
      );
      const withPages = {
        ...next,
        textLayersByPage: resizeIndependentPages(
          next.textLayersByPage,
          editorSlotCount(next.pageCount)
        ),
      };
      savePrintWizardSession(withPages);
      setState(withPages);
      return;
    }
    setState((prev) => {
      const next = {
        ...prev,
        textLayersByPage: resizeIndependentPages(
          prev.textLayersByPage,
          editorSlotCount(prev.pageCount)
        ),
      };
      savePrintWizardSession(next);
      return next;
    });
  }, []);

  useEffect(() => {
    setCurrentPage((page) =>
      Math.min(Math.max(1, page), state.pageCount)
    );
  }, [state.pageCount]);

  const updateTextLayersForPage = useCallback(
    (pageIndexToUpdate: number, layers: TextLayer[]) => {
      setState((prev) => {
        const pages = resizeIndependentPages(
          prev.textLayersByPage,
          editorSlotCount(prev.pageCount)
        );
        const nextPages = pages.map((pageLayers, idx) =>
          idx === pageIndexToUpdate ? layers : pageLayers
        );
        const next = {
          ...prev,
          inputs: patchGlobalInputsFromPage(layers, prev.inputs),
          textLayersByPage: nextPages,
        };
        savePrintWizardSession(next);
        return next;
      });
    },
    []
  );

  const onLayerTextChange = useCallback(
    (layerId: string, text: string) => {
      updateTextLayersForPage(
        editorPageIndex,
        editorPageLayers.map((layer) =>
          layer.id === layerId ? { ...layer, text } : layer
        )
      );
    },
    [editorPageIndex, editorPageLayers, updateTextLayersForPage]
  );

  const onDuplicateLayer = useCallback(
    (layerId: string) => {
      updateTextLayersForPage(
        editorPageIndex,
        duplicateTextLayer(editorPageLayers, layerId)
      );
    },
    [editorPageIndex, editorPageLayers, updateTextLayersForPage]
  );

  const onDeleteLayer = useCallback(
    (layerId: string) => {
      updateTextLayersForPage(
        editorPageIndex,
        removeTextLayer(editorPageLayers, layerId)
      );
      if (activeTextLayerId === layerId) setActiveTextLayerId(null);
    },
    [
      activeTextLayerId,
      editorPageIndex,
      editorPageLayers,
      updateTextLayersForPage,
    ]
  );

  const onAddLayer = useCallback(() => {
    updateTextLayersForPage(
      editorPageIndex,
      addPageTextLayer(editorPageLayers, editorPageIndex)
    );
  }, [editorPageIndex, editorPageLayers, updateTextLayersForPage]);

  const selectWizardPage = useCallback(
    (page: number) => {
      setLayerModalPage((open) => (open === page ? null : page));
      setCurrentPage((prev) =>
        page <= state.pageCount ? page : prev
      );
      if (page <= state.pageCount) {
        requestAnimationFrame(() => {
          document
            .getElementById(`preview-page-${page}`)
            ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      }
    },
    [state.pageCount]
  );

  const onBackToPlanning = useCallback(() => {
    setState((current) => {
      const next = { ...current, wizardStep: 1 as const };
      savePrintWizardSession(next);
      return next;
    });
  }, []);

  const patch = useCallback((partial: Partial<PrintWizardState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const wizardStep = state.wizardStep ?? 1;

  useEffect(() => {
    onNavChange?.({
      step: wizardStep,
      onBack: wizardStep === 2 ? onBackToPlanning : undefined,
    });
  }, [wizardStep, onNavChange, onBackToPlanning]);

  const onFormatChange = (formatId: PrintFormatId) => {
    setState((prev) => {
      const next = mergeInvitationBlueprint(prev, { formatId });
      savePrintWizardSession(next);
      return next;
    });
  };

  const onCustomSizeApply = (customSize: PrintCustomSize) => {
    patch({ formatId: "free", customSize });
  };

  const onUseChange = (useId: PrintUseId) => {
    setState((prev) => {
      const next = mergeInvitationBlueprint(prev, { useId });
      savePrintWizardSession(next);
      return next;
    });
  };

  const onPageCountChange = (pageCount: PrintPageCount) => {
    setState((prev) => {
      const next = mergeInvitationBlueprint(prev, { pageCount });
      savePrintWizardSession(next);
      return next;
    });
  };

  const onHideFoldGuides = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, foldGuidesHidden: true };
      savePrintWizardSession(next);
      return next;
    });
  }, []);

  const onBgKeywordChange = (bgKeyword: string) => {
    patch({ bgKeyword, bgPresetId: null });
  };

  const onBgPresetPick = (id: BgPresetId) => {
    const preset = fieldById(id);
    if (!preset) return;
    setState((prev) => {
      const next = applyAutoLayoutState(prev, { bgPresetId: id });
      savePrintWizardSession(next);
      return next;
    });
  };

  const onPromptPresetPick = (id: string, prompt: string) => {
    patch({ selectedPromptPresetId: id, mainPrompt: prompt });
  };

  const onMainPromptChange = (mainPrompt: string) => {
    patch({ mainPrompt, selectedPromptPresetId: null });
  };

  const onGenerateBackground = async (): Promise<boolean> => {
    const context = buildUnifiedPrintAiContext(state);
    if (!context || generating) return false;
    setGenerating(true);
    try {
      const format = formatById(state.formatId);
      const use = useById(state.useId);
      const urls = await generatePrintBackgroundPages({
        keyword: context,
        aspect: resolvePrintAspect(state.formatId, state.customSize),
        pageCount: state.pageCount,
        formatLabel:
          state.formatId === "free" && state.customSize
            ? `${state.customSize.width}×${state.customSize.height}${state.customSize.unit}`
            : format.label,
        useLabel: use.label,
        imageStyleId: state.visualStyle.imageStyleId,
        moodStyleId: state.visualStyle.moodStyleId,
      });
      patch({
        backgroundUrls: urls,
        backgroundUrl: urls[0] ?? null,
      });
      return urls.length > 0;
    } catch (err) {
      console.error("[print-wizard] AI background failed", err);
      window.alert(
        err instanceof Error
          ? err.message
          : "AI 배경 생성에 실패했습니다. 잠시 후 다시 시도해 주세요."
      );
      return false;
    } finally {
      setGenerating(false);
    }
  };

  const hasBackground =
    state.backgroundUrls.some(Boolean) || Boolean(state.backgroundUrl);

  const onGenerateDraft = async () => {
    if (draftBusy || generating) return;
    setDraftBusy(true);
    try {
      let ready = hasBackground;
      if (!ready) {
        ready = await onGenerateBackground();
      }
      if (!ready) {
        window.alert(cs.wizardNeedBackground);
        return;
      }
      patch({ draftReady: true });
    } finally {
      setDraftBusy(false);
    }
  };

  const onFinishStep = () => {
    if (finishBusy || draftBusy) return;
    setFinishBusy(true);
    setState((current) => {
      const bgReady =
        current.backgroundUrls.some(Boolean) || Boolean(current.backgroundUrl);
      const next = {
        ...current,
        wizardStep: 2 as const,
        draftReady: current.draftReady || bgReady,
      };
      savePrintWizardSession(next);
      return next;
    });
    setFinishBusy(false);
  };

  if (wizardStep === 2) {
    return (
      <div className="h-full min-h-0 overflow-hidden">
        <PrintWizardEditStage
          state={state}
          currentPage={currentPage}
          onCurrentPageChange={setCurrentPage}
          textLayersByPage={textLayersByPage}
          onTextLayersChange={updateTextLayersForPage}
          activeTextLayerId={activeTextLayerId}
          onActiveTextLayerChange={setActiveTextLayerId}
          onHideFoldGuides={onHideFoldGuides}
        />
      </div>
    );
  }

  return (
    <>
    <Step2Layout
      title={t.hero.ctaPrintSmartForm}
      subtitle={t.hero.printWizardStep2}
      preview={
        <PreviewCanvas
          formatId={state.formatId}
          useId={state.useId}
          pageCount={state.pageCount}
          customSize={state.customSize}
          backgroundUrl={state.backgroundUrl}
          backgroundUrls={state.backgroundUrls}
          generating={generating || draftBusy}
          datePreview={state.inputs.date}
          titlePreview={state.inputs.title}
          subtitlePreview={state.inputs.subtitle}
          locationPreview={state.inputs.location}
          organizerPreview={state.inputs.organizer}
          programsPreview={state.inputs.programs}
          overlayLayersByPage={textLayersByPage.slice(0, state.pageCount)}
          onOverlayLayersChange={updateTextLayersForPage}
          activeTextLayerId={activeTextLayerId}
          onActiveTextLayerChange={setActiveTextLayerId}
          currentPage={currentPage}
          onCurrentPageChange={setCurrentPage}
          foldGuidesHidden={state.foldGuidesHidden}
          onHideFoldGuides={onHideFoldGuides}
        />
      }
      specs={
        <SpecSettingsPanel
          formatId={state.formatId}
          useId={state.useId}
          pageCount={state.pageCount}
          customSize={state.customSize}
          bgKeyword={state.bgKeyword}
          bgPresetId={state.bgPresetId}
          selectedPromptPresetId={state.selectedPromptPresetId}
          mainPrompt={state.mainPrompt}
          visualStyle={state.visualStyle}
          generating={generating}
          onFormatChange={onFormatChange}
          onCustomSizeApply={onCustomSizeApply}
          onUseChange={onUseChange}
          onPageCountChange={onPageCountChange}
          onBgKeywordChange={onBgKeywordChange}
          onBgPresetPick={onBgPresetPick}
          onGenerateBackground={() => void onGenerateBackground()}
          onPromptPresetPick={onPromptPresetPick}
          onMainPromptChange={onMainPromptChange}
          onVisualStyleChange={(visualStyle) => patch({ visualStyle })}
        />
      }
      form={
        <SmartInputForm
          currentPage={layerModalPage ?? currentPage}
          onSelectPage={selectWizardPage}
          wizardMode
          draftBusy={draftBusy}
          finishBusy={finishBusy}
          draftReady={state.draftReady === true}
          onGenerateDraft={() => void onGenerateDraft()}
          onFinishStep={onFinishStep}
        />
      }
    />
    {layerModalPage != null ? (
      <PageLayerEditModal
        page={layerModalPage}
        totalPages={EDITOR_PAGE_SLOTS}
        layers={editorPageLayers}
        activeLayerId={activeTextLayerId}
        onActiveLayerChange={setActiveTextLayerId}
        onLayerTextChange={onLayerTextChange}
        onDuplicate={onDuplicateLayer}
        onDelete={onDeleteLayer}
        onAddLayer={onAddLayer}
        onClose={() => setLayerModalPage(null)}
      />
    ) : null}
    </>
  );
}
