"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import StudioExportButtonGroup from "@/components/canvas/StudioExportButtonGroup";
import SpecSettingsPanel from "@/components/print-wizard/SpecSettingsPanel";
import PrintUnifiedEditorCanvas from "@/components/print-unified-editor/PrintUnifiedEditorCanvas";
import PrintUnifiedEditorLayout from "@/components/print-unified-editor/PrintUnifiedEditorLayout";
import PrintUnifiedEditorPageBar from "@/components/print-unified-editor/PrintUnifiedEditorPageBar";
import { usePrintWizardExport } from "@/lib/canvas/usePrintWizardExport";
import { buildPagePrintAiContext } from "@/lib/printWizardAiContext";
import {
  generatePrintBackgroundPages,
  pageBackgroundUrl,
  resizeBackgroundPans,
} from "@/lib/printWizardBg";
import {
  createDecoLayer,
  createSymbolLayer,
  resizeDecoPages,
} from "@/lib/printWizardDecoLayers";
import {
  PRINT_UNIFIED_EDITOR_SESSION_KEY,
  type PrintUnifiedZoom,
} from "@/lib/printUnifiedEditor";
import {
  applySemanticPageLayout,
  editorSlotCount,
  reconcileLayerTypographyBox,
  referencePrintStageSize,
  resizeIndependentPages,
} from "@/lib/printWizardTextLayers";
import { compositePrintWizardPageBlob, printWizardHasExportableFrame } from "@/lib/printWizardComposite";
import {
  defaultPrintWizardState,
  formatById,
  markSpecPick,
  resolvePrintAspect,
  useById,
  type BgPresetId,
  type PrintCustomSize,
  type PrintDecoLayer,
  type PrintFormatId,
  type PrintPageCount,
  type PrintUseId,
  type PrintWizardState,
} from "@/lib/printWizardTypes";
import { PRINT_WIZARD_SESSION_KEY } from "@/lib/printWizardTypes";
import { toDisplayImageSrc } from "@/lib/resultSession";
import type { TextLayer } from "@/lib/thumbnailStyles";

const AiTemplateStudio = dynamic(
  () => import("@/components/AiTemplateStudio"),
  { ssr: false }
);

function readSession(key: string): PrintWizardState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PrintWizardState;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function saveSession(state: PrintWizardState) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      PRINT_UNIFIED_EDITOR_SESSION_KEY,
      JSON.stringify(state)
    );
  } catch {
    /* ignore quota */
  }
}

function hydrateInitialState(): PrintWizardState {
  const unified = readSession(PRINT_UNIFIED_EDITOR_SESSION_KEY);
  if (unified) return unified;
  const wizard = readSession(PRINT_WIZARD_SESSION_KEY);
  if (wizard) return { ...wizard, wizardStep: 2 };
  return {
    ...defaultPrintWizardState(),
    pageCount: 8 as PrintPageCount,
    wizardStep: 2,
  };
}

/**
 * Screen 26 — one-page unified print editor (canvas + specs + design tools).
 */
export default function PrintUnifiedEditor() {
  const [state, setState] = useState<PrintWizardState>(defaultPrintWizardState);
  const [hydrated, setHydrated] = useState(false);
  /** 0 until the user clicks a page tab — no canvas guides on first paint. */
  const [currentPage, setCurrentPage] = useState(0);
  const [zoom, setZoom] = useState<PrintUnifiedZoom>(1);
  const [generating, setGenerating] = useState(false);
  const [activeTextLayerId, setActiveTextLayerId] = useState<string | null>(
    null
  );
  const [activeDecoLayerId, setActiveDecoLayerId] = useState<string | null>(
    null
  );
  const [hiddenTextHost, setHiddenTextHost] = useState<HTMLDivElement | null>(
    null
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    setState(hydrateInitialState());
    setHydrated(true);
  }, []);

  const patch = useCallback((partial: Partial<PrintWizardState>) => {
    setState((prev) => {
      const next = { ...prev, ...partial };
      saveSession(next);
      return next;
    });
  }, []);

  const textLayersByPage = useMemo(
    () =>
      resizeIndependentPages(
        state.textLayersByPage,
        editorSlotCount(state.pageCount)
      ),
    [state.textLayersByPage, state.pageCount]
  );

  const decoLayersByPage = useMemo(
    () => resizeDecoPages(state.decoLayersByPage, state.pageCount),
    [state.decoLayersByPage, state.pageCount]
  );

  const pageActivated = currentPage > 0;
  const pageIndex = pageActivated ? currentPage - 1 : -1;
  const aspect = resolvePrintAspect(state.formatId, state.customSize);
  const typographyStage = useMemo(
    () => referencePrintStageSize(aspect),
    [aspect]
  );

  const overlayLayers = useMemo(() => {
    if (!pageActivated || pageIndex < 0) return [];
    const raw = textLayersByPage[pageIndex] ?? [];
    return applySemanticPageLayout(raw, pageIndex);
  }, [textLayersByPage, pageIndex, pageActivated]);

  const onTextLayersChange = useCallback(
    (
      layers: TextLayer[],
      options?: { applyLayout?: boolean }
    ) => {
      if (!pageActivated || pageIndex < 0) return;
      const nextLayers =
        options?.applyLayout === false
          ? layers
          : applySemanticPageLayout(layers, pageIndex);
      setState((prev) => {
        const slots = editorSlotCount(prev.pageCount);
        const pages = resizeIndependentPages(prev.textLayersByPage, slots);
        const nextPages = pages.map((page, idx) =>
          idx === pageIndex
            ? nextLayers.map((layer) =>
                reconcileLayerTypographyBox(
                  layer,
                  typographyStage.w,
                  typographyStage.h
                )
              )
            : page
        );
        const next = { ...prev, textLayersByPage: nextPages };
        saveSession(next);
        return next;
      });
    },
    [pageIndex, pageActivated, typographyStage.h, typographyStage.w]
  );

  const updateDecoLayersForPage = useCallback(
    (idx: number, layers: PrintDecoLayer[]) => {
      setState((prev) => {
        const pages = resizeDecoPages(prev.decoLayersByPage, prev.pageCount);
        const nextPages = pages.map((pageLayers, i) =>
          i === idx ? layers : pageLayers
        );
        const next = { ...prev, decoLayersByPage: nextPages };
        saveSession(next);
        return next;
      });
    },
    []
  );

  const onDecoCatalogPick = useCallback(
    (decoId: string) => {
      if (!pageActivated) return;
      const idx = currentPage - 1;
      const stage = referencePrintStageSize(
        resolvePrintAspect(stateRef.current.formatId, stateRef.current.customSize)
      );
      const stackIndex = decoLayersByPage[idx]?.length ?? 0;
      try {
        const layer = createDecoLayer(decoId, stage.w, stage.h, stackIndex);
        updateDecoLayersForPage(idx, [...(decoLayersByPage[idx] ?? []), layer]);
        setActiveDecoLayerId(layer.id);
        setActiveTextLayerId(null);
      } catch {
        /* invalid deco */
      }
    },
    [currentPage, decoLayersByPage, pageActivated, updateDecoLayersForPage]
  );

  const onCanvasSymbolPick = useCallback(
    (symbol: string) => {
      if (!pageActivated) return;
      const idx = currentPage - 1;
      const stage = referencePrintStageSize(
        resolvePrintAspect(stateRef.current.formatId, stateRef.current.customSize)
      );
      const stackIndex = decoLayersByPage[idx]?.length ?? 0;
      try {
        const layer = createSymbolLayer(symbol, stage.w, stage.h, stackIndex);
        updateDecoLayersForPage(idx, [...(decoLayersByPage[idx] ?? []), layer]);
        setActiveDecoLayerId(layer.id);
        setActiveTextLayerId(null);
      } catch {
        /* empty symbol */
      }
    },
    [currentPage, decoLayersByPage, pageActivated, updateDecoLayersForPage]
  );

  const onGenerateBackground = useCallback(async () => {
    if (generating) return;
    const s = stateRef.current;
    const keywords = Array.from({ length: s.pageCount }, (_, i) =>
      buildPagePrintAiContext(s, i)
    );
    if (!keywords[0]) return;
    setGenerating(true);
    try {
      const format = formatById(s.formatId);
      const use = useById(s.useId);
      const urls = await generatePrintBackgroundPages({
        keyword: keywords[0],
        keywords,
        aspect: resolvePrintAspect(s.formatId, s.customSize),
        pageCount: s.pageCount,
        formatLabel:
          s.formatId === "free" && s.customSize
            ? `${s.customSize.width}×${s.customSize.height}${s.customSize.unit}`
            : format.label,
        useLabel: use.label,
        imageStyleId: s.visualStyle.imageStyleId,
        moodStyleId: s.visualStyle.moodStyleId,
      });
      patch({
        backgroundUrls: urls,
        backgroundUrl: urls[0] ?? null,
        backgroundPansByPage: resizeBackgroundPans(undefined, s.pageCount),
      });
    } catch (err) {
      console.error("[unified-editor] AI background failed", err);
      window.alert(
        err instanceof Error
          ? err.message
          : "AI 배경 생성에 실패했습니다. 잠시 후 다시 시도해 주세요."
      );
    } finally {
      setGenerating(false);
    }
  }, [generating, patch]);

  const selectPage = useCallback(
    (page: number) => {
      if (page < 1 || page > state.pageCount) return;
      setCurrentPage(page);
      setActiveTextLayerId(null);
      setActiveDecoLayerId(null);
      const idx = page - 1;
      setState((prev) => {
        const slots = editorSlotCount(prev.pageCount);
        const pages = resizeIndependentPages(prev.textLayersByPage, slots);
        const nextPages = [...pages];
        nextPages[idx] = applySemanticPageLayout(
          pages[idx]?.length ? pages[idx]! : [],
          idx
        );
        const next = { ...prev, textLayersByPage: nextPages };
        saveSession(next);
        return next;
      });
    },
    [state.pageCount]
  );

  const backgroundUrl = useMemo(() => {
    const raw = pageBackgroundUrl(state.backgroundUrls, state.backgroundUrl, 0);
    return raw ? toDisplayImageSrc(raw) : null;
  }, [state.backgroundUrl, state.backgroundUrls]);

  const activeBg =
    pageActivated && pageIndex >= 0
      ? pageBackgroundUrl(state.backgroundUrls, state.backgroundUrl, pageIndex)
      : null;

  const {
    busy: exportBusy,
    projectFileInputRef,
    downloadWithProject,
    loadProjectFile,
    loadProjectFromGallery,
    sharePreview,
    requireSubscription,
    premiumModal: exportPremiumModal,
  } = usePrintWizardExport({
    activeBg,
    customSize: state.customSize,
    aspect,
    titlePreview: state.inputs.title,
    studioPath: "/print-unified-editor",
    pendingProjectKey: "print_unified_editor",
    recentNamespace: "screen_008",
    overlayLayers,
    resolveExportImage: async (quality) => {
      if (!pageActivated || pageIndex < 0) {
        throw new Error("no_page_selected");
      }
      const exportState: PrintWizardState = {
        ...stateRef.current,
        textLayersByPage,
        decoLayersByPage,
      };
      if (!printWizardHasExportableFrame(exportState)) {
        throw new Error("nothing_to_export");
      }
      return compositePrintWizardPageBlob({
        state: exportState,
        pageIndex,
        quality,
      });
    },
  });

  if (!hydrated) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-white/60">
        에디터 준비 중…
      </div>
    );
  }

  return (
    <>
      <div
        ref={setHiddenTextHost}
        className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0"
        aria-hidden
      />
      <PrintUnifiedEditorLayout
        canvas={
          <PrintUnifiedEditorCanvas
            formatId={state.formatId}
            useId={state.useId}
            pageCount={state.pageCount}
            customSize={state.customSize}
            currentPage={currentPage}
            pageActivated={pageActivated}
            backgroundUrl={state.backgroundUrl}
            backgroundUrls={state.backgroundUrls}
            backgroundPansByPage={state.backgroundPansByPage}
            textLayers={overlayLayers}
            onTextLayersChange={(layers) =>
              onTextLayersChange(layers, { applyLayout: false })
            }
            decoLayers={
              pageActivated ? decoLayersByPage[pageIndex] : undefined
            }
            onDecoLayersChange={
              pageActivated
                ? (layers) => updateDecoLayersForPage(pageIndex, layers)
                : undefined
            }
            activeTextLayerId={activeTextLayerId}
            onActiveTextLayerChange={setActiveTextLayerId}
            activeDecoLayerId={activeDecoLayerId}
            onActiveDecoLayerChange={setActiveDecoLayerId}
            foldGuidesHidden={state.foldGuidesHidden}
            onHideFoldGuides={() => patch({ foldGuidesHidden: true })}
            zoom={zoom}
            onZoomChange={setZoom}
          />
        }
        controls={
          <SpecSettingsPanel
            formatId={state.formatId}
            useId={state.useId}
            pageCount={state.pageCount}
            customSize={state.customSize}
            specPicks={state.specPicks}
            bgKeyword={state.bgKeyword}
            bgPresetId={state.bgPresetId}
            selectedPromptPresetId={state.selectedPromptPresetId}
            mainPrompt={state.mainPrompt}
            visualStyle={state.visualStyle}
            generating={generating}
            onFormatChange={(id: PrintFormatId) =>
              patch(markSpecPick({ ...stateRef.current, formatId: id }, "format"))
            }
            onCustomSizeApply={(size: PrintCustomSize) =>
              patch(
                markSpecPick(
                  { ...stateRef.current, formatId: "free", customSize: size },
                  "format"
                )
              )
            }
            onUseChange={(id: PrintUseId) =>
              patch(markSpecPick({ ...stateRef.current, useId: id }, "use"))
            }
            onPageCountChange={(count: PrintPageCount) => {
              patch(
                markSpecPick({ ...stateRef.current, pageCount: count }, "pages")
              );
              setCurrentPage((p) => (p > count ? 0 : p));
            }}
            onBgKeywordChange={(keyword) => patch({ bgKeyword: keyword })}
            onBgPresetPick={(id: BgPresetId) => patch({ bgPresetId: id })}
            onGenerateBackground={() => void onGenerateBackground()}
            onPromptPresetPick={(id, prompt) =>
              patch({
                selectedPromptPresetId: id,
                mainPrompt: prompt,
              })
            }
            onMainPromptChange={(value) => patch({ mainPrompt: value })}
            onVisualStyleChange={(visualStyle) => patch({ visualStyle })}
          />
        }
        designPanel={
          <div className="flex h-full min-h-0 w-full flex-col gap-2">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
              <AiTemplateStudio
                mode="agent"
                embedded
                panelOnly
                hideExport
                hideAiCommand
                textLayersHost={hiddenTextHost}
                initialBackgroundUrl={backgroundUrl}
                controlledOverlayLayers={overlayLayers}
                onControlledOverlayLayersChange={(layers) =>
                  onTextLayersChange(
                    layers.map((layer) =>
                      reconcileLayerTypographyBox(
                        layer,
                        typographyStage.w,
                        typographyStage.h
                      )
                    ),
                    { applyLayout: false }
                  )
                }
                controlledActiveLayerId={activeTextLayerId}
                onControlledActiveLayerChange={setActiveTextLayerId}
                formFields={{ ...state.inputs }}
                initialVisualStyle={state.visualStyle}
                onDecoCatalogPick={onDecoCatalogPick}
                onCanvasSymbolPick={onCanvasSymbolPick}
              />
            </div>
            <PrintUnifiedEditorPageBar
              currentPage={currentPage}
              pageCount={state.pageCount}
              onSelectPage={selectPage}
            />
            <div className="shrink-0">
              <StudioExportButtonGroup
                busy={exportBusy}
                onDownloadStandard={() => void downloadWithProject("standard")}
                onDownloadHigh={() => void downloadWithProject("high")}
                onLoadProjectClick={() => {
                  if (!requireSubscription()) return;
                  projectFileInputRef.current?.click();
                }}
                onLoadFromGallery={(project) => loadProjectFromGallery(project)}
                requireSubscription={requireSubscription}
                onShare={() => void sharePreview()}
                fileInputRef={projectFileInputRef}
                onFileChange={(file) => void loadProjectFile(file)}
                variant="studio"
                showHint
              />
            </div>
          </div>
        }
      />
      {exportPremiumModal}
    </>
  );
}
