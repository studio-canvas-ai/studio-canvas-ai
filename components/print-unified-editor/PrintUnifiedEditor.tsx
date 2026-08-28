"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import StudioExportButtonGroup from "@/components/canvas/StudioExportButtonGroup";
import { useFeedback } from "@/components/FeedbackProvider";
import SpecSettingsPanel from "@/components/print-wizard/SpecSettingsPanel";
import PrintUnifiedEditorCanvas from "@/components/print-unified-editor/PrintUnifiedEditorCanvas";
import PrintUnifiedEditorMiniThumbs from "@/components/print-unified-editor/PrintUnifiedEditorMiniThumbs";
import PrintUnifiedEditorLayout from "@/components/print-unified-editor/PrintUnifiedEditorLayout";
import {
  PRINT_UNIFIED_EDITOR_SESSION_KEY,
  applyUnifiedEditorPageLayout,
  createDefaultUnifiedGuideLayers,
  isBlankUnifiedTextPage,
  resizeBlankIsolatedPages,
  resizeContentOffsets,
  type PrintContentOffset,
  type PrintUnifiedZoom,
} from "@/lib/printUnifiedEditor";
import {
  TEMPLATE_WAREHOUSE_APPLY_EVENT,
  consumePendingWarehouseTemplate,
  type WarehouseTemplate,
} from "@/lib/templateWarehouse";
import {
  reconcileLayerTypographyBox,
  referencePrintStageSize,
} from "@/lib/printWizardTextLayers";
import { usePrintWizardExport } from "@/lib/canvas/usePrintWizardExport";
import { useCanvasStore } from "@/lib/canvas/canvasStore";
import type { PhotoKind } from "@/lib/canvas/addPhotoLayer";
import type { StudioCanvasProjectV1 } from "@/lib/canvas/projectFile";
import {
  backgroundStateFromProject,
  decoLayersByPageFromProject,
  photoLayersByPageFromProject,
} from "@/lib/canvas/projectFile";
import {
  applyPhotoLookbookSnapshot,
  capturePhotoLookbookSnapshot,
  isPhotoLookbookSnapshot,
} from "@/lib/photoLookbookProject";
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
import { compositePrintWizardPageBlob, printWizardHasExportableFrame } from "@/lib/printWizardComposite";
import {
  createPrintPhotoLayerFromFile,
  resizePhotoPages,
} from "@/lib/printWizardPhotoLayers";
import {
  defaultPrintWizardState,
  formatById,
  markSpecPick,
  normalizeFormatId,
  PRINT_PAGE_COUNTS,
  resolvePrintAspect,
  useById,
  type BgPresetId,
  type PrintCustomSize,
  type PrintDecoLayer,
  type PrintFormatId,
  type PrintPageCount,
  type PrintPhotoLayer,
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

function coercePrintPageCount(
  value: unknown,
  fallback: PrintPageCount
): PrintPageCount {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  const hit = PRINT_PAGE_COUNTS.find((p) => p.value === n);
  return hit ? hit.value : fallback;
}

/** Keep restored layer boxes from being restacked into a single vertical column. */
function preserveRestoredTextLayer(layer: TextLayer): TextLayer {
  const next: TextLayer = {
    ...layer,
    ranges: layer.ranges?.map((r) => ({ ...r })) ?? [],
  };
  const hasManual =
    typeof next.manualX === "number" &&
    Number.isFinite(next.manualX) &&
    typeof next.manualY === "number" &&
    Number.isFinite(next.manualY);
  const hasBox =
    typeof next.boxW === "number" &&
    next.boxW > 0 &&
    typeof next.boxH === "number" &&
    next.boxH > 0;
  if (!hasManual && !hasBox) return next;
  return {
    ...next,
    layoutLocked: true,
    boxManual: true,
  };
}

function cloneTextPagesFromWizard(
  pages: TextLayer[][] | undefined,
  pageCount: PrintPageCount
): TextLayer[][] {
  const cloned = (pages || []).map((page) =>
    (page || []).map(preserveRestoredTextLayer)
  );
  return resizeBlankIsolatedPages(cloned, pageCount);
}

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
  const wizard = unified
    ? unified
    : (() => {
        const fromWizard = readSession(PRINT_WIZARD_SESSION_KEY);
        return fromWizard ? { ...fromWizard, wizardStep: 2 as const } : null;
      })();
  if (wizard) {
    const pageCount = coercePrintPageCount(wizard.pageCount, 8);
    // Drop all-empty placeholder pages left by the old cross-page seed bug.
    const textLayersByPage = resizeBlankIsolatedPages(
      wizard.textLayersByPage,
      pageCount
    );
    return {
      ...wizard,
      pageCount,
      wizardStep: 2,
      textLayersByPage,
      photoLayersByPage: resizePhotoPages(wizard.photoLayersByPage, pageCount),
      decoLayersByPage: resizeDecoPages(wizard.decoLayersByPage, pageCount),
      backgroundUrls: Array.from({ length: pageCount }, (_, i) =>
        wizard.backgroundUrls?.[i] ||
        (i === 0 && wizard.backgroundUrl ? wizard.backgroundUrl : "") ||
        ""
      ),
      contentOffsetByPage: resizeContentOffsets(
        wizard.contentOffsetByPage,
        pageCount
      ),
    };
  }
  const pageCount = 8 as PrintPageCount;
  return {
    ...defaultPrintWizardState(),
    pageCount,
    wizardStep: 2,
    textLayersByPage: resizeBlankIsolatedPages(undefined, pageCount),
    photoLayersByPage: Array.from({ length: pageCount }, () => []),
    decoLayersByPage: Array.from({ length: pageCount }, () => []),
    backgroundUrls: Array.from({ length: pageCount }, () => ""),
  };
}

/**
 * Screen 26 — one-page unified print editor (canvas + specs + design tools).
 */
export default function PrintUnifiedEditor() {
  const { showToast } = useFeedback();
  const [state, setState] = useState<PrintWizardState>(defaultPrintWizardState);
  const [hydrated, setHydrated] = useState(false);
  /** 0 until the user clicks a page tab — no canvas guides on first paint. */
  const [currentPage, setCurrentPage] = useState(0);
  const [zoom, setZoom] = useState<PrintUnifiedZoom>(1);
  const [generating, setGenerating] = useState(false);
  const [activeTextLayerId, setActiveTextLayerId] = useState<string | null>(
    null
  );
  const [activePhotoLayerId, setActivePhotoLayerId] = useState<string | null>(
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
  const formatSeedKeyRef = useRef("");

  const seedGuideLayersForPage = useCallback((pageIndexToSeed: number) => {
    if (pageIndexToSeed < 0) return;
    setState((prev) => {
      const pages = resizeBlankIsolatedPages(
        prev.textLayersByPage,
        prev.pageCount
      );
      if (pageIndexToSeed >= pages.length) return prev;
      const existing = pages[pageIndexToSeed] ?? [];
      if (!isBlankUnifiedTextPage(existing)) return prev;

      const stage = referencePrintStageSize(
        resolvePrintAspect(prev.formatId, prev.customSize)
      );
      const seeded = createDefaultUnifiedGuideLayers(
        pageIndexToSeed,
        stage.w,
        stage.h
      );
      const nextPages = pages.map((page, i) =>
        i === pageIndexToSeed ? seeded : page
      );
      const next = { ...prev, textLayersByPage: nextPages };
      saveSession(next);
      return next;
    });
  }, []);

  const activatePage = useCallback((page: number) => {
    setCurrentPage(page);
    setActiveTextLayerId(null);
    setActiveDecoLayerId(null);
    setActivePhotoLayerId(null);
    if (page > 0) {
      seedGuideLayersForPage(page - 1);
    }
  }, [seedGuideLayersForPage]);

  useEffect(() => {
    setState(hydrateInitialState());
    setHydrated(true);
  }, []);

  const applyWarehouseTemplateToEditor = useCallback(
    (detail: WarehouseTemplate) => {
      if (!detail?.id) return;
      const pageCount = detail.pageCount;
      const stage = referencePrintStageSize(
        resolvePrintAspect(detail.formatId, null)
      );
      // Only template pages get layers — other faces stay blank (no clone).
      const textPages = resizeBlankIsolatedPages(
        detail.textLayersByPage,
        pageCount
      ).map((page, i) => {
        if (!page.length) return [];
        return applyUnifiedEditorPageLayout(page, i, stage.w, stage.h);
      });
      const next: PrintWizardState = {
        ...defaultPrintWizardState(),
        ...stateRef.current,
        formatId: detail.formatId,
        pageCount,
        wizardStep: 2,
        backgroundUrl: detail.backgroundUrl ?? null,
        backgroundUrls: Array.from({ length: pageCount }, (_, i) =>
          i === 0 ? detail.backgroundUrl || "" : ""
        ),
        textLayersByPage: textPages,
        photoLayersByPage: Array.from({ length: pageCount }, () => []),
        decoLayersByPage: Array.from({ length: pageCount }, () => []),
        backgroundPansByPage: resizeBackgroundPans(undefined, pageCount),
        contentOffsetByPage: resizeContentOffsets(undefined, pageCount),
        foldGuidesHidden: false,
        specPicks: {
          format: true,
          style: Boolean(stateRef.current.visualStyle?.imageStyleId),
          use: true,
          pages: true,
        },
      };
      saveSession(next);
      setState(next);
      activatePage(1);
      setZoom(1);
      showToast(`템플릿 적용: ${detail.title}`, "success");
    },
    [activatePage, showToast]
  );

  /** Template Warehouse → apply seed layout onto this editor (additive listener). */
  useEffect(() => {
    const onApply = (event: Event) => {
      const detail = (event as CustomEvent<WarehouseTemplate>).detail;
      // Clear pending stash so remount does not double-apply.
      consumePendingWarehouseTemplate();
      if (detail) applyWarehouseTemplateToEditor(detail);
    };
    window.addEventListener(TEMPLATE_WAREHOUSE_APPLY_EVENT, onApply);
    return () =>
      window.removeEventListener(TEMPLATE_WAREHOUSE_APPLY_EVENT, onApply);
  }, [applyWarehouseTemplateToEditor]);

  useEffect(() => {
    if (!hydrated) return;
    const pending = consumePendingWarehouseTemplate();
    if (pending) applyWarehouseTemplateToEditor(pending);
  }, [hydrated, applyWarehouseTemplateToEditor]);

  const patch = useCallback((partial: Partial<PrintWizardState>) => {
    setState((prev) => {
      const next = { ...prev, ...partial };
      saveSession(next);
      return next;
    });
  }, []);

  const textLayersByPage = useMemo(
    () => resizeBlankIsolatedPages(state.textLayersByPage, state.pageCount),
    [state.textLayersByPage, state.pageCount]
  );

  const decoLayersByPage = useMemo(
    () => resizeDecoPages(state.decoLayersByPage, state.pageCount),
    [state.decoLayersByPage, state.pageCount]
  );

  const photoLayersByPage = useMemo(
    () => resizePhotoPages(state.photoLayersByPage, state.pageCount),
    [state.photoLayersByPage, state.pageCount]
  );

  const pageActivated = currentPage > 0;
  const pageIndex = pageActivated ? currentPage - 1 : -1;

  const aspect = resolvePrintAspect(state.formatId, state.customSize);
  const typographyStage = useMemo(
    () => referencePrintStageSize(aspect),
    [aspect]
  );

  /**
   * Active page layers from multi-page state — raw, no layout re-seed.
   * Screen 8/24 parity: empty placeholders stay invisible without showEmptyGuideBoxes;
   * never filter/write a transformed copy back into pages[i].
   */
  const activeTextLayers = useMemo(() => {
    if (!pageActivated || pageIndex < 0) return [];
    return textLayersByPage[pageIndex] ?? [];
  }, [textLayersByPage, pageIndex, pageActivated]);

  /**
   * Screen 24 style: callers pass the page index from the event/render that
   * produced the layers. Also reject accidental [] overwrites of a filled page
   * (late blur after navigate can emit empty payloads).
   */
  const onTextLayersChange = useCallback(
    (
      pageIndexToUpdate: number,
      layers: TextLayer[],
      options?: { applyLayout?: boolean }
    ) => {
      if (pageIndexToUpdate < 0) return;

      const nextLayers =
        options?.applyLayout === false
          ? layers
          : applyUnifiedEditorPageLayout(
              layers,
              pageIndexToUpdate,
              typographyStage.w,
              typographyStage.h
            );

      setState((prev) => {
        const pages = resizeBlankIsolatedPages(
          prev.textLayersByPage,
          prev.pageCount
        );
        if (pageIndexToUpdate >= pages.length) return prev;
        const existing = pages[pageIndexToUpdate] ?? [];
        const savedLayers =
          options?.applyLayout === false
            ? nextLayers
            : nextLayers.map((layer) =>
                reconcileLayerTypographyBox(
                  layer,
                  typographyStage.w,
                  typographyStage.h
                )
              );
        // Contaminated empty commit after page switch — never wipe a filled face.
        if (savedLayers.length === 0 && existing.length > 0) {
          return prev;
        }
        const nextPages = pages.map((page, i) =>
          i === pageIndexToUpdate ? savedLayers : page
        );
        const next = { ...prev, textLayersByPage: nextPages };
        saveSession(next);
        return next;
      });
    },
    [typographyStage.h, typographyStage.w]
  );

  const updateDecoLayersForPage = useCallback(
    (idx: number, layers: PrintDecoLayer[]) => {
      if (idx < 0) return;
      setState((prev) => {
        const pages = resizeDecoPages(prev.decoLayersByPage, prev.pageCount);
        if (idx >= pages.length) return prev;
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

  const updatePhotoLayersForPage = useCallback(
    (idx: number, layers: PrintPhotoLayer[]) => {
      if (idx < 0) return;
      setState((prev) => {
        const pages = resizePhotoPages(prev.photoLayersByPage, prev.pageCount);
        if (idx >= pages.length) return prev;
        const nextPages = pages.map((pageLayers, i) =>
          i === idx ? layers : pageLayers
        );
        const next = { ...prev, photoLayersByPage: nextPages };
        saveSession(next);
        return next;
      });
    },
    []
  );

  const onInstallPhoto = useCallback(
    async (file: File, mode: PhotoKind) => {
      if (!pageActivated) {
        showToast("페이지를 먼저 선택해 주세요.", "info");
        return;
      }
      const pageIdx = currentPage - 1;
      const aspect = resolvePrintAspect(
        stateRef.current.formatId,
        stateRef.current.customSize
      );
      const stageW = 1080;
      const stageH = Math.max(1, Math.round(stageW / Math.max(aspect, 0.05)));
      const stackIndex = photoLayersByPage[pageIdx]?.length ?? 0;
      const layer = await createPrintPhotoLayerFromFile(file, {
        mode,
        stageW,
        stageH,
        stackIndex,
      });
      updatePhotoLayersForPage(pageIdx, [
        ...(photoLayersByPage[pageIdx] ?? []),
        layer,
      ]);
      setActivePhotoLayerId(layer.id);
      setActiveTextLayerId(null);
      setActiveDecoLayerId(null);
    },
    [
      currentPage,
      pageActivated,
      photoLayersByPage,
      showToast,
      updatePhotoLayersForPage,
    ]
  );

  const resetWorkspace = useCallback(() => {
    const pageCount = 8 as PrintPageCount;
    const next: PrintWizardState = {
      ...defaultPrintWizardState(),
      pageCount,
      wizardStep: 2,
      textLayersByPage: resizeBlankIsolatedPages(undefined, pageCount),
      photoLayersByPage: Array.from({ length: pageCount }, () => []),
      decoLayersByPage: Array.from({ length: pageCount }, () => []),
      backgroundUrls: Array.from({ length: pageCount }, () => ""),
      backgroundUrl: null,
      backgroundPansByPage: resizeBackgroundPans(undefined, pageCount),
      contentOffsetByPage: resizeContentOffsets(undefined, pageCount),
      foldGuidesHidden: false,
    };
    saveSession(next);
    setState(next);
    setCurrentPage(0);
    setZoom(1);
    setGenerating(false);
    setActiveTextLayerId(null);
    setActivePhotoLayerId(null);
    setActiveDecoLayerId(null);
    useCanvasStore.getState().resetDocument();
    showToast("편집 상태를 초기화했습니다.", "success");
  }, [showToast]);

  const onOpenRecentProject = useCallback(
    (project: StudioCanvasProjectV1) => {
      // Prefer full lookbook wizard maps so pages 1–N stay distributed (Screen 24 parity).
      if (isPhotoLookbookSnapshot(project.lookbook)) {
        const { wizard } = applyPhotoLookbookSnapshot(project.lookbook);
        const pageCount = coercePrintPageCount(
          wizard.pageCount,
          state.pageCount
        );
        const formatId =
          normalizeFormatId(wizard.formatId) ||
          (project.studio.customPrint ? ("free" as const) : state.formatId);
        const backgroundUrls = Array.from({ length: pageCount }, (_, i) => {
          const fromWizard = wizard.backgroundUrls?.[i];
          if (typeof fromWizard === "string" && fromWizard.trim()) {
            return fromWizard;
          }
          if (i === 0 && wizard.backgroundUrl?.trim()) {
            return wizard.backgroundUrl;
          }
          return "";
        });
        const backgroundUrl =
          backgroundUrls.find((u) => u.trim()) ||
          wizard.backgroundUrl ||
          state.backgroundUrl;

        const next: PrintWizardState = {
          ...state,
          ...wizard,
          pageCount,
          formatId,
          useId: wizard.useId || state.useId,
          customSize: project.studio.customPrint
            ? {
                unit: project.studio.customPrint.unit,
                width: project.studio.customPrint.width,
                height: project.studio.customPrint.height,
              }
            : (wizard.customSize ?? state.customSize),
          backgroundUrl,
          backgroundUrls,
          backgroundPansByPage: resizeBackgroundPans(
            wizard.backgroundPansByPage,
            pageCount
          ),
          contentOffsetByPage: resizeContentOffsets(
            wizard.contentOffsetByPage,
            pageCount
          ),
          textLayersByPage: cloneTextPagesFromWizard(
            wizard.textLayersByPage,
            pageCount
          ),
          photoLayersByPage: resizePhotoPages(
            wizard.photoLayersByPage,
            pageCount
          ),
          decoLayersByPage: resizeDecoPages(
            wizard.decoLayersByPage,
            pageCount
          ),
          visualStyle:
            wizard.visualStyle ??
            project.studio.visualStyle ??
            state.visualStyle,
          inputs: wizard.inputs ?? state.inputs,
          wizardStep: 2,
        };
        saveSession(next);
        setState(next);
        activatePage(1);
        showToast(
          "최근 수정파일을 불러와 편집 상태를 복원했습니다.",
          "success"
        );
        return;
      }

      // Legacy .sca without lookbook: map overlay + helpers onto current pageCount.
      const pageIdx = pageActivated ? Math.max(0, currentPage - 1) : 0;
      const layers = (project.studio.overlayLayers || []).map((l) =>
        preserveRestoredTextLayer(l)
      );
      const textPages = resizeBlankIsolatedPages(
        state.textLayersByPage,
        state.pageCount
      );
      if (layers.length) {
        textPages[pageIdx] = layers;
      }

      const bgState = backgroundStateFromProject(
        project,
        state.pageCount,
        pageIdx
      );
      const photoPages = resizePhotoPages(
        photoLayersByPageFromProject(project, state.pageCount, pageIdx),
        state.pageCount
      );
      const decoFromProject = decoLayersByPageFromProject(
        project,
        state.pageCount
      );
      const decoPages = decoFromProject
        ? resizeDecoPages(decoFromProject, state.pageCount)
        : resizeDecoPages(state.decoLayersByPage, state.pageCount);

      const next: PrintWizardState = {
        ...state,
        backgroundUrl: bgState.backgroundUrl || state.backgroundUrl,
        backgroundUrls: bgState.backgroundUrls.some((u) => u.trim())
          ? bgState.backgroundUrls
          : state.backgroundUrls,
        backgroundPansByPage:
          bgState.backgroundPansByPage ?? state.backgroundPansByPage,
        photoLayersByPage: photoPages,
        decoLayersByPage: decoPages,
        textLayersByPage: textPages,
        visualStyle: project.studio.visualStyle ?? state.visualStyle,
        customSize: project.studio.customPrint
          ? {
              unit: project.studio.customPrint.unit,
              width: project.studio.customPrint.width,
              height: project.studio.customPrint.height,
            }
          : state.customSize,
        formatId: project.studio.customPrint
          ? ("free" as const)
          : state.formatId,
        wizardStep: 2,
      };
      saveSession(next);
      setState(next);
      activatePage(pageIdx + 1);
      showToast(
        "최근 수정파일을 불러와 편집 상태를 복원했습니다.",
        "success"
      );
    },
    [activatePage, currentPage, pageActivated, showToast, state]
  );

  const updateContentOffsetForPage = useCallback(
    (idx: number, offset: PrintContentOffset) => {
      setState((prev) => {
        const pages = resizeContentOffsets(
          prev.contentOffsetByPage,
          prev.pageCount
        );
        const nextPages = pages.map((item, i) => (i === idx ? offset : item));
        const next = { ...prev, contentOffsetByPage: nextPages };
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
      // Load page 1 onto the main canvas so editing can start immediately
      // (mini thumbs alone leave currentPage at 0 → blank center stage).
      activatePage(1);
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
  }, [activatePage, generating, patch]);

  const selectPage = useCallback(
    (page: number) => {
      if (page < 1 || page > state.pageCount) return;
      activatePage(page);
    },
    [activatePage, state.pageCount]
  );

  const formatSeedKey = `${state.formatId}|${state.customSize?.width ?? ""}|${state.customSize?.height ?? ""}|${state.customSize?.unit ?? ""}`;

  useEffect(() => {
    if (!pageActivated || pageIndex < 0) return;
    if (!formatSeedKeyRef.current) {
      formatSeedKeyRef.current = formatSeedKey;
      return;
    }
    if (formatSeedKeyRef.current === formatSeedKey) return;
    formatSeedKeyRef.current = formatSeedKey;

    setState((prev) => {
      const pages = resizeBlankIsolatedPages(
        prev.textLayersByPage,
        prev.pageCount
      );
      const stage = referencePrintStageSize(
        resolvePrintAspect(prev.formatId, prev.customSize)
      );
      let changed = false;
      const nextPages = pages.map((page, i) => {
        if (!isBlankUnifiedTextPage(page)) return page;
        changed = true;
        return createDefaultUnifiedGuideLayers(i, stage.w, stage.h);
      });
      if (!changed) return prev;
      const next = { ...prev, textLayersByPage: nextPages };
      saveSession(next);
      return next;
    });
  }, [formatSeedKey, pageActivated, pageIndex]);

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
    overlayLayers: activeTextLayers,
    onApplyRecentProject: onOpenRecentProject,
    depositToSpace4: true,
    buildLookbookSnapshot: () =>
      capturePhotoLookbookSnapshot({
        ...stateRef.current,
        textLayersByPage,
        decoLayersByPage,
        photoLayersByPage,
      }),
    resolveExportImage: async (quality) => {
      if (!pageActivated || pageIndex < 0) {
        throw new Error("no_page_selected");
      }
      const exportState: PrintWizardState = {
        ...stateRef.current,
        textLayersByPage,
        decoLayersByPage,
        photoLayersByPage,
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
            contentOffsetByPage={state.contentOffsetByPage}
            onContentOffsetChange={updateContentOffsetForPage}
            textLayers={activeTextLayers}
            onTextLayersChange={(idx, layers) =>
              onTextLayersChange(idx, layers, { applyLayout: false })
            }
            photoLayers={
              pageActivated ? photoLayersByPage[pageIndex] : undefined
            }
            onPhotoLayersChange={
              pageActivated
                ? (idx, layers) => updatePhotoLayersForPage(idx, layers)
                : undefined
            }
            activePhotoLayerId={activePhotoLayerId}
            onActivePhotoLayerChange={(id) => {
              setActivePhotoLayerId(id);
              if (id) {
                setActiveTextLayerId(null);
                setActiveDecoLayerId(null);
              }
            }}
            decoLayers={
              pageActivated ? decoLayersByPage[pageIndex] : undefined
            }
            onDecoLayersChange={
              pageActivated
                ? (idx, layers) => updateDecoLayersForPage(idx, layers)
                : undefined
            }
            activeTextLayerId={activeTextLayerId}
            onActiveTextLayerChange={(id) => {
              setActiveTextLayerId(id);
              if (id) {
                setActivePhotoLayerId(null);
                setActiveDecoLayerId(null);
              }
            }}
            activeDecoLayerId={activeDecoLayerId}
            onActiveDecoLayerChange={(id) => {
              setActiveDecoLayerId(id);
              if (id) {
                setActiveTextLayerId(null);
                setActivePhotoLayerId(null);
              }
            }}
            foldGuidesHidden={state.foldGuidesHidden}
            onHideFoldGuides={() => patch({ foldGuidesHidden: true })}
            zoom={zoom}
            onZoomChange={setZoom}
            exportBusy={exportBusy}
            generating={generating}
            requireSubscription={requireSubscription}
            onInstallPhoto={onInstallPhoto}
            onOpenRecentProject={onOpenRecentProject}
            onResetWorkspace={resetWorkspace}
            recentNamespace="screen_008"
          />
        }
        controls={
          <div className="flex h-full min-h-0 flex-col gap-2">
            {/* Specs + AI generate: natural height, no inner scroll / clipped CTA */}
            <div className="shrink-0 overflow-visible">
              <SpecSettingsPanel
                fitContent
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
                  patch(
                    markSpecPick({ ...stateRef.current, formatId: id }, "format")
                  )
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
                  patch({
                    ...markSpecPick(
                      { ...stateRef.current, pageCount: count },
                      "pages"
                    ),
                    contentOffsetByPage: resizeContentOffsets(
                      stateRef.current.contentOffsetByPage,
                      count
                    ),
                  });
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
                onVisualStyleChange={(visualStyle) => {
                  const hasStyle = Boolean(
                    visualStyle.imageStyleId || visualStyle.moodStyleId
                  );
                  patch(
                    markSpecPick(
                      { ...stateRef.current, visualStyle },
                      "style",
                      hasStyle
                    )
                  );
                }}
              />
            </div>
            {/* Empty flex space — do not stretch mini thumbs into the middle */}
            <div className="min-h-0 flex-1" aria-hidden />
            <div className="mt-auto shrink-0">
              <PrintUnifiedEditorMiniThumbs
                formatId={state.formatId}
                customSize={state.customSize}
                pageCount={state.pageCount}
                currentPage={currentPage}
                backgroundUrl={state.backgroundUrl}
                backgroundUrls={state.backgroundUrls}
                backgroundPansByPage={state.backgroundPansByPage}
                onSelectPage={selectPage}
              />
            </div>
          </div>
        }
        designPanel={
          <div className="flex h-full min-h-0 w-full flex-col gap-2">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
              <AiTemplateStudio
                key={`unified-studio-${pageIndex}`}
                mode="agent"
                embedded
                panelOnly
                hideExport
                hideAiCommand
                alwaysShowStylePanel
                textLayersHost={hiddenTextHost}
                initialBackgroundUrl={backgroundUrl}
                controlledOverlayLayers={activeTextLayers}
                onControlledOverlayLayersChange={(layers) =>
                  onTextLayersChange(
                    pageIndex,
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
                variant="unified"
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
