"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import StudioExportButtonGroup from "@/components/canvas/StudioExportButtonGroup";
import StudioShareModal from "@/components/canvas/StudioShareModal";
import { useCredits } from "@/components/CreditsProvider";
import { useFeedback } from "@/components/FeedbackProvider";
import SpecSettingsPanel from "@/components/print-wizard/SpecSettingsPanel";
import type { SpecSettingsTagId } from "@/components/print-wizard/AiBackgroundPromptBar";
import PrintUnifiedEditorCanvas from "@/components/print-unified-editor/PrintUnifiedEditorCanvas";
import PrintUnifiedEditorMiniThumbs from "@/components/print-unified-editor/PrintUnifiedEditorMiniThumbs";
import PrintUnifiedEditorLayout from "@/components/print-unified-editor/PrintUnifiedEditorLayout";
import Space4AdminReviewBar from "@/components/print-unified-editor/Space4AdminReviewBar";
import {
  DEFAULT_CONTENT_OFFSET,
  PRINT_UNIFIED_EDITOR_SESSION_KEY,
  applyUnifiedEditorPageLayout,
  resizeBlankIsolatedPages,
  resizeContentOffsets,
  resizePageThumbUrls,
  stripLegacyUnifiedGuideLayers,
  type PrintContentOffset,
  type PrintUnifiedZoom,
} from "@/lib/printUnifiedEditor";
import {
  TEMPLATE_WAREHOUSE_APPLY_EVENT,
  consumePendingWarehouseTemplate,
  openTemplateWarehouse,
  type WarehouseTemplate,
} from "@/lib/templateWarehouse";
import {
  SPACE4_ADMIN_REVIEW_APPLY_EVENT,
  clearSpace4AdminReview,
  getSpace4AdminReview,
  takeSpace4ReviewProject,
  type Space4AdminReviewSession,
} from "@/lib/space4AdminReview";
import { publishSpace4ReviewToTemplate03 } from "@/lib/space4Client";
import {
  reconcileLayerTypographyBox,
  referencePrintStageSize,
} from "@/lib/printWizardTextLayers";
import { usePrintWizardExport } from "@/lib/canvas/usePrintWizardExport";
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
  DEFAULT_BG_PAN,
  generatePrintBackgroundDataUrl,
  nextEmptyBackgroundPageIndex,
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
  FIELD_CATEGORIES,
  fieldById,
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
import {
  emptyVisualStyleSelection,
  resolveVisualStylePreset,
} from "@/lib/ai/visualStylePresets";
import { mapLayoutPlanToCanvasLayers } from "@/lib/ai/printLayoutEngine";
import { requestGenerateLayout } from "@/lib/ai/requestGenerateLayout";

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

/**
 * Screen 26 — target page for Magic Layout + Fal background.
 * Page 1 + existing bg → next empty slot; else the selected page.
 */
function resolveBackgroundGenerationTarget(
  state: PrintWizardState,
  selectedPage: number
): { pageIndex: number } | null {
  const pageOneHasBackground = Boolean(
    pageBackgroundUrl(state.backgroundUrls, state.backgroundUrl, 0)
  );
  const effectivePage = selectedPage > 0 ? selectedPage : 1;

  if (effectivePage === 1) {
    if (!pageOneHasBackground) {
      return { pageIndex: 0 };
    }
    const nextEmpty = nextEmptyBackgroundPageIndex(
      state.backgroundUrls,
      state.backgroundUrl,
      state.pageCount
    );
    if (nextEmpty < 0) return null;
    return { pageIndex: nextEmpty };
  }

  const pageIndex = effectivePage - 1;
  if (pageIndex < 0 || pageIndex >= state.pageCount) return null;
  return { pageIndex };
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
    // Drop legacy 상단/중간/하단 guide ghosts and empty seed pages.
    const textLayersByPage = stripLegacyUnifiedGuideLayers(
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
      pageThumbUrls: resizePageThumbUrls(wizard.pageThumbUrls, pageCount),
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
    pageThumbUrls: Array.from({ length: pageCount }, () => ""),
  };
}

/**
 * Screen 26 — one-page unified print editor (canvas + specs + design tools).
 */
export default function PrintUnifiedEditor() {
  const { showToast } = useFeedback();
  const { isAdmin } = useCredits();
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
  const [space4Review, setSpace4Review] =
    useState<Space4AdminReviewSession | null>(null);
  const [publishingSpace4, setPublishingSpace4] = useState(false);
  const [saveCanvasBusy, setSaveCanvasBusy] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;
  const formatSeedKeyRef = useRef("");

  const activatePage = useCallback((page: number) => {
    setCurrentPage(page);
    setActiveTextLayerId(null);
    setActiveDecoLayerId(null);
    setActivePhotoLayerId(null);
  }, []);

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

  const clearSpecTag = useCallback((key: SpecSettingsTagId) => {
    setState((prev) => {
      let next: PrintWizardState = { ...prev };
      switch (key) {
        case "format":
          next = markSpecPick(
            { ...next, formatId: "a4", customSize: null },
            "format",
            false
          );
          break;
        case "style":
          next = markSpecPick(
            { ...next, visualStyle: emptyVisualStyleSelection() },
            "style",
            false
          );
          break;
        case "use":
          next = markSpecPick({ ...next, useId: "flyer" }, "use", false);
          break;
        case "prompt":
          next = { ...next, bgKeyword: "" };
          break;
        case "bg":
          next = { ...next, bgPresetId: null };
          break;
        default:
          break;
      }
      saveSession(next);
      return next;
    });
  }, []);

  const deleteCurrentPageSlide = useCallback(() => {
    if (!pageActivated || pageIndex < 0) {
      showToast("페이지를 먼저 선택해 주세요.", "info");
      return;
    }
    const removeIndex = pageIndex;

    setState((prev) => {
      const n = Math.max(1, prev.pageCount);

      const splicePad = <T,>(
        arr: T[] | undefined,
        empty: () => T
      ): T[] => {
        const next = Array.from({ length: n }, (_, i) =>
          arr?.[i] !== undefined ? (arr[i] as T) : empty()
        );
        if (removeIndex >= 0 && removeIndex < next.length) {
          next.splice(removeIndex, 1);
        }
        while (next.length < n) next.push(empty());
        return next.slice(0, n);
      };

      const backgroundUrls = splicePad<string>(
        Array.from({ length: n }, (_, i) =>
          prev.backgroundUrls?.[i] ??
          (i === 0 ? prev.backgroundUrl ?? "" : "")
        ),
        () => ""
      );
      const textLayersByPage = splicePad(
        resizeBlankIsolatedPages(prev.textLayersByPage, n),
        () => [] as TextLayer[]
      );
      const photoLayersByPage = splicePad(
        resizePhotoPages(prev.photoLayersByPage, n),
        () => []
      );
      const decoLayersByPage = splicePad(
        resizeDecoPages(prev.decoLayersByPage, n),
        () => []
      );
      const pageThumbUrls = splicePad(
        resizePageThumbUrls(prev.pageThumbUrls, n),
        () => ""
      );
      const contentOffsetByPage = splicePad(
        resizeContentOffsets(prev.contentOffsetByPage, n),
        () => ({ ...DEFAULT_CONTENT_OFFSET })
      );
      const backgroundPansByPage = splicePad(
        resizeBackgroundPans(prev.backgroundPansByPage, n),
        () => ({ ...DEFAULT_BG_PAN })
      );

      const next: PrintWizardState = {
        ...prev,
        backgroundUrls,
        backgroundUrl: backgroundUrls.find((u) => u.trim()) || null,
        textLayersByPage,
        photoLayersByPage,
        decoLayersByPage,
        pageThumbUrls,
        contentOffsetByPage,
        backgroundPansByPage,
      };
      saveSession(next);
      return next;
    });

    // Keep the same slot active so old page N+1 becomes the new page at this index.
    activatePage(removeIndex + 1);
    setActiveTextLayerId(null);
    setActiveDecoLayerId(null);
    setActivePhotoLayerId(null);
    showToast("페이지를 삭제하고 뒤 페이지를 앞으로 당겼습니다.", "success");
  }, [activatePage, pageActivated, pageIndex, showToast]);

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
          pageThumbUrls: resizePageThumbUrls(wizard.pageThumbUrls, pageCount),
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

  const applySpace4ReviewProject = useCallback(() => {
    const review = getSpace4AdminReview();
    if (!review) return;
    setSpace4Review(review);
    const pending = takeSpace4ReviewProject();
    if (pending) onOpenRecentProject(pending);
  }, [onOpenRecentProject]);

  useEffect(() => {
    if (!hydrated || !isAdmin) return;
    applySpace4ReviewProject();
  }, [hydrated, isAdmin, applySpace4ReviewProject]);

  useEffect(() => {
    if (!isAdmin) return;
    const onApply = () => applySpace4ReviewProject();
    window.addEventListener(SPACE4_ADMIN_REVIEW_APPLY_EVENT, onApply);
    return () =>
      window.removeEventListener(SPACE4_ADMIN_REVIEW_APPLY_EVENT, onApply);
  }, [isAdmin, applySpace4ReviewProject]);

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
    const target = resolveBackgroundGenerationTarget(
      s,
      currentPageRef.current
    );
    if (!target) {
      window.alert(
        `${s.pageCount}페이지 배경이 모두 생성되었습니다. 미니 보기에서 페이지를 선택해 편집하거나, 배경을 삭제한 뒤 다시 생성해 주세요.`
      );
      return;
    }
    const { pageIndex } = target;
    const userTheme =
      s.bgKeyword.trim() ||
      fieldById(s.bgPresetId)?.keyword?.trim() ||
      s.mainPrompt.trim();
    if (!userTheme && !buildPagePrintAiContext(s, pageIndex).trim()) return;

    setGenerating(true);
    try {
      const format = formatById(s.formatId);
      const use = useById(s.useId);
      const field = fieldById(s.bgPresetId);
      const fieldCategory = FIELD_CATEGORIES.find((group) =>
        group.items.some((item) => item.id === s.bgPresetId)
      );
      const stylePreset = resolveVisualStylePreset(s.visualStyle.imageStyleId);
      const aspect = resolvePrintAspect(s.formatId, s.customSize);
      const stage = referencePrintStageSize(aspect);
      const formatLabel =
        s.formatId === "free" && s.customSize
          ? `${s.customSize.width}×${s.customSize.height}${s.customSize.unit}`
          : format.label;
      const prompt =
        userTheme || buildPagePrintAiContext(s, pageIndex);

      // 1) Gemini Magic Layout — required (no soft-fail to background-only).
      const plan = await requestGenerateLayout({
        formatLabel,
        styleLabel: stylePreset?.labelKo || "모던",
        useLabel: use.label,
        backgroundFieldLabel: field?.label || field?.keyword || "일반",
        categoryLabel: fieldCategory?.label,
        prompt,
        canvasWidth: stage.w,
        canvasHeight: stage.h,
        pageIndex,
        pageCount: s.pageCount,
      });
      const mapped = mapLayoutPlanToCanvasLayers(plan, stage.w, stage.h, {
        styleLabel: stylePreset?.labelKo || "모던",
        useLabel: use.label,
        backgroundFieldLabel: field?.label || field?.keyword || "일반",
        categoryLabel: fieldCategory?.label,
        prompt,
      });
      if (!mapped.textLayers.length && !mapped.decoLayers.length) {
        throw new Error(
          "레이아웃 요소가 비어 있습니다. 옵션/프롬프트를 확인한 뒤 다시 생성해 주세요."
        );
      }

      // 2) Fal background from Gemini bg_prompt.
      const url = await generatePrintBackgroundDataUrl({
        keyword: plan.bg_prompt,
        directEnglishPrompt: plan.bg_prompt,
        aspect,
        pageIndex,
        pageCount: s.pageCount,
        formatLabel,
        useLabel: use.label,
        imageStyleId: s.visualStyle.imageStyleId,
        moodStyleId: s.visualStyle.moodStyleId,
      });

      // 3) Atomic inject: background + all layout layers on the target page.
      const urls = Array.from({ length: s.pageCount }, (_, i) =>
        s.backgroundUrls?.[i] ?? (i === 0 ? s.backgroundUrl ?? "" : "")
      );
      urls[pageIndex] = url;

      const textPages = resizeBlankIsolatedPages(
        s.textLayersByPage,
        s.pageCount
      ).map((page, i) => (i === pageIndex ? mapped.textLayers : page));
      const decoPages = resizeDecoPages(s.decoLayersByPage, s.pageCount).map(
        (page, i) => (i === pageIndex ? mapped.decoLayers : page)
      );
      const photoPages = resizePhotoPages(s.photoLayersByPage, s.pageCount).map(
        (page, i) => (i === pageIndex ? [] : page)
      );

      patch({
        backgroundUrls: urls,
        backgroundUrl: urls[0] ?? null,
        backgroundPansByPage: resizeBackgroundPans(
          s.backgroundPansByPage,
          s.pageCount
        ),
        textLayersByPage: textPages,
        decoLayersByPage: decoPages,
        photoLayersByPage: photoPages,
      });

      const firstText = mapped.textLayers.find((layer) =>
        Boolean(String(layer.text || "").replace(/\u200B/g, "").trim())
      );
      // activatePage clears selection — set page then re-select main text.
      setCurrentPage(pageIndex + 1);
      setActiveTextLayerId(firstText?.id ?? null);
      setActiveDecoLayerId(null);
      setActivePhotoLayerId(null);
    } catch (err) {
      console.error("[unified-editor] Magic template generate failed", err);
      window.alert(
        err instanceof Error
          ? err.message
          : "AI 템플릿 생성에 실패했습니다. 잠시 후 다시 시도해 주세요."
      );
    } finally {
      setGenerating(false);
    }
  }, [generating, patch]);

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
    // Format change: keep absolute / Magic Layout pages; never re-seed zone guides.
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
    saveToGallery,
    buildCurrentProject,
    loadProjectFile,
    loadProjectFromGallery,
    sharePreview,
    shareModalProps,
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
      const activePage = currentPageRef.current;
      const exportPageIndex = activePage > 0 ? activePage - 1 : -1;
      if (exportPageIndex < 0) {
        throw new Error("no_page_selected");
      }
      const exportState: PrintWizardState = {
        ...stateRef.current,
        textLayersByPage,
        decoLayersByPage,
        photoLayersByPage,
      };
      if (!printWizardHasExportableFrame(exportState, exportPageIndex)) {
        throw new Error("nothing_to_export");
      }
      return compositePrintWizardPageBlob({
        state: exportState,
        pageIndex: exportPageIndex,
        quality,
      });
    },
  });

  const saveCanvasToSlotAndGallery = useCallback(async () => {
    if (!pageActivated || pageIndex < 0) {
      showToast("페이지를 먼저 선택해 주세요.", "info");
      return;
    }
    if (saveCanvasBusy || exportBusy) return;
    setSaveCanvasBusy(true);
    try {
      const exportState: PrintWizardState = {
        ...stateRef.current,
        textLayersByPage,
        decoLayersByPage,
        photoLayersByPage,
      };
      const blob = await compositePrintWizardPageBlob({
        state: exportState,
        pageIndex,
        quality: "standard",
      });
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("thumb_read_failed"));
        reader.readAsDataURL(blob);
      });
      const pageThumbUrls = resizePageThumbUrls(
        stateRef.current.pageThumbUrls,
        stateRef.current.pageCount
      );
      pageThumbUrls[pageIndex] = dataUrl;
      const nextState: PrintWizardState = {
        ...stateRef.current,
        textLayersByPage,
        decoLayersByPage,
        photoLayersByPage,
        pageThumbUrls,
      };
      stateRef.current = nextState;
      saveSession(nextState);
      setState(nextState);

      const galleryResult = await saveToGallery({ silent: true });
      if (galleryResult?.ok) {
        showToast(
          "현재 페이지가 미니 보기 슬롯과 내 갤러리에 저장되었습니다.",
          "success"
        );
      } else if (galleryResult?.ok === false) {
        showToast(
          "미니 보기 슬롯에는 저장됐지만 갤러리 백업에 실패했습니다.",
          "info"
        );
      } else {
        showToast("현재 페이지가 미니 보기 슬롯에 저장되었습니다.", "success");
      }
    } catch (err) {
      console.error("[unified-editor] canvas save failed", err);
      showToast("저장에 실패했습니다. 잠시 후 다시 시도해 주세요.", "error");
    } finally {
      setSaveCanvasBusy(false);
    }
  }, [
    decoLayersByPage,
    exportBusy,
    pageActivated,
    pageIndex,
    photoLayersByPage,
    saveCanvasBusy,
    saveToGallery,
    showToast,
    textLayersByPage,
  ]);

  const onPublishSpace4Review = useCallback(async () => {
    if (!space4Review || publishingSpace4) return;
    setPublishingSpace4(true);
    try {
      const project = buildCurrentProject();
      const result = await publishSpace4ReviewToTemplate03({
        space4Id: space4Review.space4Id,
        project,
      });
      if (!result.ok) {
        showToast("공개(03) 발행에 실패했습니다.", "error");
        return;
      }
      clearSpace4AdminReview();
      setSpace4Review(null);
      showToast(
        "Template 03 공개 템플릿으로 발행했습니다. 템플릿 창고를 엽니다.",
        "success"
      );
      window.setTimeout(() => openTemplateWarehouse("public"), 350);
    } finally {
      setPublishingSpace4(false);
    }
  }, [
    buildCurrentProject,
    publishingSpace4,
    showToast,
    space4Review,
  ]);

  const onCancelSpace4Review = useCallback(() => {
    clearSpace4AdminReview();
    setSpace4Review(null);
    showToast("Template 04 검수 세션을 종료했습니다.", "info");
  }, [showToast]);

  const specSettingsPanel = (
    <SpecSettingsPanel
      fitContent
      hidePageCountOption
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
          ...markSpecPick({ ...stateRef.current, pageCount: count }, "pages"),
          contentOffsetByPage: resizeContentOffsets(
            stateRef.current.contentOffsetByPage,
            count
          ),
          pageThumbUrls: resizePageThumbUrls(
            stateRef.current.pageThumbUrls,
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
      onClearSpecTag={clearSpecTag}
    />
  );

  if (!hydrated) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center text-sm font-semibold text-slate-900">
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
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {isAdmin && space4Review ? (
          <div className="shrink-0 px-3 pt-1 sm:px-4">
            <Space4AdminReviewBar
              label={space4Review.label}
              publishing={publishingSpace4}
              onPublish={() => void onPublishSpace4Review()}
              onCancel={onCancelSpace4Review}
            />
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-hidden">
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
            onSaveCanvas={() => void saveCanvasToSlotAndGallery()}
            saveCanvasBusy={saveCanvasBusy || exportBusy}
            onClearCanvasImage={deleteCurrentPageSlide}
            recentNamespace="screen_008"
          />
        }
        controls={
          <div className="flex flex-col gap-2 p-1.5 max-lg:shrink-0 sm:p-2 lg:h-full lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:p-2.5 lg:pb-4">
            {/* Desktop middle column — mobile AI panel lives in designPanel */}
            <div className="hidden min-h-0 shrink-0 lg:block">{specSettingsPanel}</div>
            <div className="hidden min-h-0 flex-1 lg:block" aria-hidden />
            <div className="max-lg:shrink-0 lg:mt-auto lg:shrink-0">
              <p className="mb-1.5 hidden px-0.5 text-xs leading-snug text-pink-500 [word-break:keep-all] lg:block">
                내가 만든 디자인은 운영자 검수 및 민감 개인정보 삭제를 거쳐
                템플릿창고(Template 03)에 공개 템플릿으로 등록되며, 다른
                사용자들의 무료 디자인 참고 자료로 활용될 수 있음을 고지합니다.
              </p>
              <PrintUnifiedEditorMiniThumbs
                formatId={state.formatId}
                customSize={state.customSize}
                pageCount={state.pageCount}
                currentPage={currentPage}
                backgroundUrl={state.backgroundUrl}
                backgroundUrls={state.backgroundUrls}
                pageThumbUrls={state.pageThumbUrls}
                backgroundPansByPage={state.backgroundPansByPage}
                onSelectPage={selectPage}
              />
            </div>
          </div>
        }
        designPanel={
          <div className="flex h-full min-h-0 w-full flex-col gap-2 p-2 max-lg:h-auto max-lg:min-h-0 sm:p-2.5">
            {/* Mobile: AI background → style tools; desktop: style tools only (AI in middle column) */}
            <div className="order-1 flex min-h-0 flex-col gap-2 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:[scrollbar-gutter:stable]">
              <div className="shrink-0 lg:hidden">{specSettingsPanel}</div>
              <div className="min-h-0 max-lg:flex-none lg:flex-1 lg:min-h-0">
                <AiTemplateStudio
                  key={`unified-studio-${pageIndex}`}
                  mode="agent"
                  embedded
                  panelOnly
                  tone="light"
                  hideExport
                  hideAiCommand
                  alwaysShowStylePanel
                  textLayersHost={hiddenTextHost}
                  initialBackgroundUrl={backgroundUrl}
                  controlledOverlayLayers={activeTextLayers}
                  onControlledOverlayLayersChange={(layers) => {
                    const idx = currentPage > 0 ? currentPage - 1 : 0;
                    if (currentPage <= 0) {
                      setCurrentPage(1);
                    }
                    onTextLayersChange(
                      idx,
                      layers.map((layer) =>
                        reconcileLayerTypographyBox(
                          layer,
                          typographyStage.w,
                          typographyStage.h
                        )
                      ),
                      { applyLayout: false }
                    );
                  }}
                  controlledActiveLayerId={activeTextLayerId}
                  onControlledActiveLayerChange={(id) => {
                    setActiveTextLayerId(id);
                    if (id) {
                      setActivePhotoLayerId(null);
                      setActiveDecoLayerId(null);
                    }
                  }}
                  formFields={{ ...state.inputs }}
                  initialVisualStyle={state.visualStyle}
                  onDecoCatalogPick={onDecoCatalogPick}
                  onCanvasSymbolPick={onCanvasSymbolPick}
                />
              </div>
            </div>
            <div className="order-2 shrink-0">
              <StudioExportButtonGroup
                busy={exportBusy}
                onDownloadStandard={() => void downloadWithProject("standard")}
                onDownloadHigh={() => void downloadWithProject("high")}
                onDownloadUltra={() => void downloadWithProject("ultra")}
                onLoadProjectClick={() => {
                  if (!requireSubscription()) return;
                  projectFileInputRef.current?.click();
                }}
                onLoadFromGallery={(project) => loadProjectFromGallery(project)}
                requireSubscription={requireSubscription}
                onShare={sharePreview}
                fileInputRef={projectFileInputRef}
                onFileChange={(file) => void loadProjectFile(file)}
                variant="unified"
                useSharedGalleryVault
                showHint
              />
            </div>
          </div>
        }
      />
        </div>
      </div>
      {exportPremiumModal}
      <StudioShareModal {...shareModalProps} />
    </>
  );
}
