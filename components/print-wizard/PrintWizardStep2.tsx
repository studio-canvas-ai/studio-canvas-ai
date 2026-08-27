"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import dynamic from "next/dynamic";
import { Loader2, Download } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useFeedback } from "@/components/FeedbackProvider";
import { useDownloadQuota } from "@/lib/useDownloadQuota";
import Step2Layout from "@/components/print-wizard/Step2Layout";
import PreviewCanvas from "@/components/print-wizard/PreviewCanvas";
import SpecSettingsPanel from "@/components/print-wizard/SpecSettingsPanel";
import SmartInputForm from "@/components/print-wizard/SmartInputForm";
import PageLayerEditModal from "@/components/print-wizard/PageLayerEditModal";
import {
  generatePrintBackgroundPages,
  pageBackgroundUrl,
  resizeBackgroundPans,
} from "@/lib/printWizardBg";
import { runPhotoInpaintGenerate } from "@/lib/photoInpaintGenerate";
import { photoInpaintUi } from "@/lib/photoInpaintCopy";
import {
  LOOKBOOK_SUBJECT_LAYER_ID,
  cleanScenicBackgroundFromPlate,
  createLookbookSubjectLayer,
  cutoutLookbookSubject,
  generateLookbookBaseSceneDualLayer,
  generateLookbookScenicBackground,
  generateLookbookSubjectCutout,
  replaceSubjectLayerCutout,
} from "@/lib/photoLookbookDualLayer";
import { resolvePhotoIdentitySrc } from "@/lib/photoInpaintScene";
import {
  ID_PHOTO_STYLE_ID,
  ID_PHOTO_STUDIO_LOCK,
  createSolidBackgroundHttps,
  cutoutOriginalIdentityOnly,
  isIdPhotoLookbookMode,
  parseIdPhotoBackgroundColor,
  shouldUseSolidIdBackground,
} from "@/lib/photoIdPhotoBackground";
import {
  buildPagePrintAiContext,
} from "@/lib/printWizardAiContext";
import {
  getWizardProduct,
  type WizardProductId,
} from "@/lib/wizard/wizardProduct";
import type { WizardDraftStorage } from "@/lib/wizard/wizardDraftStorage";
import { useCanvasStore } from "@/lib/canvas/canvasStore";
import { usePrintWizardExport } from "@/lib/canvas/usePrintWizardExport";
import type { StudioCanvasProjectV1 } from "@/lib/canvas/projectFile";
import {
  backgroundStateFromProject,
  decoLayersByPageFromProject,
  photoLayersByPageFromProject,
} from "@/lib/canvas/projectFile";
import {
  applyPhotoLookbookSnapshot,
  capturePhotoLookbookSnapshot,
  compositePhotoLookbookBlob,
  isPhotoLookbookSnapshot,
  photoLookbookHasExportableFrame,
} from "@/lib/photoLookbookProject";
import {
  applySemanticPageLayout,
  editorSlotCount,
  EDITOR_PAGE_SLOTS,
  patchGlobalInputsFromPage,
  referencePrintStageSize,
  removeTextLayer,
  resizeIndependentPages,
  resolvePageTextLayersForExport,
} from "@/lib/printWizardTextLayers";
import { mergeInvitationBlueprint } from "@/lib/printWizardBlueprint";
import {
  applyAutoLayoutState,
} from "@/lib/ai/autoLayoutEngine";
import type { TextLayer } from "@/lib/thumbnailStyles";
import {
  createDecoLayer,
  createSymbolLayer,
  resizeDecoPages,
} from "@/lib/printWizardDecoLayers";
import {
  createPrintPhotoLayerFromFile,
  createPrintPhotoLayerFromSrc,
  isAllowedPrintPhotoFile,
  refitPhotoLayersByPageForAspect,
  resizePhotoPages,
} from "@/lib/printWizardPhotoLayers";
import { readFileAsDataUrl, type PhotoKind } from "@/lib/canvas/addPhotoLayer";
import {
  processSubjectViaApi,
  toRawImageUrl,
} from "@/lib/aiCommand";
import { blobToCompressedDataUrl } from "@/lib/processUpload";
import {
  pushUploadVaultItem,
  type PhotoVaultItem,
} from "@/lib/photoVaultStorage";
import { toDisplayImageSrc } from "@/lib/resultSession";
import type { PrintBackgroundPan, PrintDecoLayer, PrintPhotoLayer } from "@/lib/printWizardTypes";
import {
  coercePhotoFormatId,
  coercePhotoUseId,
  fieldById,
  formatById,
  resolvePrintAspect,
  useById,
  type BgPresetId,
  type PrintCustomSize,
  type PrintFormatId,
  type PrintUseId,
  type PrintPageCount,
  type PrintWizardState,
} from "@/lib/printWizardTypes";
import { markSpecPick } from "@/lib/printWizardTypes";
import FaceVaultPanel from "@/components/ai-photo-generator/FaceVaultPanel";

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
  productId?: WizardProductId;
  draftStorage?: WizardDraftStorage;
};

/**
 * Print Smart Form ??2-step wizard orchestrator.
 * Step 1: specs + AI background + detail content input.
 * Step 2: canvas + Template Studio edit panel.
 */
export default function PrintWizardStep2({
  onNavChange,
  productId = "print",
  draftStorage: draftStorageProp,
}: PrintWizardStep2Props) {
  const product = getWizardProduct(productId);
  const saveSession = product.session.save;
  const readSession = product.session.read;
  const clearSession = product.session.clear;
  const saveDraft = (draftStorageProp ?? product.drafts).saveDraft;
  const draftChangedEvent = (draftStorageProp ?? product.drafts).changedEvent;
  const createDefaultState = product.defaultState;
  const { showToast } = useFeedback();
  const studioPath = product.studioPath;
  const pendingProjectKey = product.pendingProjectKey;
  const recentNamespace = product.recentNamespace;
  const { t, locale } = useI18n();
  const cs = t.canvasStudio;
  const {
    standardLabel,
    highLabel,
    canDownloadStandard,
    canDownloadHigh,
  } = useDownloadQuota();
  const panelTitle = productId === "photo" ? cs.photoTitle : undefined;
  const [state, setState] = useState<PrintWizardState>(createDefaultState);
  const [generating, setGenerating] = useState(false);
  const [generatingKind, setGeneratingKind] = useState<
    "background" | "subject" | null
  >(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const [finishBusy, setFinishBusy] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTextLayerId, setActiveTextLayerId] = useState<string | null>(
    null
  );
  const [activePhotoLayerId, setActivePhotoLayerId] = useState<string | null>(
    null
  );
  const [activeDecoLayerId, setActiveDecoLayerId] = useState<string | null>(
    null
  );

  const [layerModalPage, setLayerModalPage] = useState<number | null>(null);
  const [workspaceEpoch, setWorkspaceEpoch] = useState(0);
  /** Forces PreviewCanvas plate <img> remount after each AI result. */
  const [lookbookPlateEpoch, setLookbookPlateEpoch] = useState(0);
  const stateRef = useRef(state);
  stateRef.current = state;
  /** After recent-file restore, skip one-shot session remount auto-layout. */
  const skipAutoLayoutOnceRef = useRef(false);

  const textLayersByPage = useMemo(() => {
    return resizeIndependentPages(
      state.textLayersByPage,
      editorSlotCount(state.pageCount)
    );
  }, [state.textLayersByPage, state.pageCount]);

  const photoLayersByPage = useMemo(() => {
    return resizePhotoPages(state.photoLayersByPage, state.pageCount);
  }, [state.photoLayersByPage, state.pageCount]);

  const decoLayersByPage = useMemo(() => {
    return resizeDecoPages(state.decoLayersByPage, state.pageCount);
  }, [state.decoLayersByPage, state.pageCount]);

  const backgroundPansByPage = useMemo(() => {
    return resizeBackgroundPans(state.backgroundPansByPage, state.pageCount);
  }, [state.backgroundPansByPage, state.pageCount]);

  const editorPage = layerModalPage ?? currentPage;
  const editorPageIndex = Math.max(0, editorPage - 1);
  const editorPageLayers = textLayersByPage[editorPageIndex] ?? [];

  useEffect(() => {
    const saved = readSession();
    if (skipAutoLayoutOnceRef.current) {
      skipAutoLayoutOnceRef.current = false;
      return;
    }
    if (saved) {
      const next = applyAutoLayoutState(
        { ...saved, wizardStep: 1 as const },
        { bgPresetId: saved.bgPresetId }
      );
      const photoLocked =
        productId === "photo"
          ? {
              useId: coercePhotoUseId(next.useId),
              formatId: coercePhotoFormatId(next.formatId),
              pageCount: 1 as const,
              decoLayersByPage: [] as PrintDecoLayer[][],
              specPicks: {
                ...(next.specPicks ?? {
                  format: false,
                  style: false,
                  use: false,
                  pages: false,
                }),
                pages: true,
              },
            }
          : null;
      const merged = { ...next, ...photoLocked };
      const resized = resizeIndependentPages(
        merged.textLayersByPage,
        editorSlotCount(merged.pageCount)
      );
      // Preserve user/manual layouts — only seed semantic layout on empty/default pages.
      const withPages = {
        ...merged,
        textLayersByPage: resized.map((page, i) => {
          const hasUserLayout = page.some(
            (l) => l.layoutLocked || Boolean(l.text?.trim())
          );
          return hasUserLayout ? page : applySemanticPageLayout(page, i);
        }),
      };
      saveSession(withPages);
      setState(withPages);
      return;
    }
    setState((prev) => {
      const next = {
        ...prev,
        textLayersByPage: resizeIndependentPages(
          prev.textLayersByPage,
          editorSlotCount(prev.pageCount)
        ).map((page, i) => applySemanticPageLayout(page, i)),
      };
      saveSession(next);
      return next;
    });
  }, []);

  useEffect(() => {
    setCurrentPage((page) =>
      Math.min(Math.max(1, page), state.pageCount)
    );
  }, [state.pageCount]);

  const updateTextLayersForPage = useCallback(
    (
      pageIndexToUpdate: number,
      layersOrUpdater: TextLayer[] | ((prevLayers: TextLayer[]) => TextLayer[]),
      options?: { applyLayout?: boolean }
    ) => {
      setState((prev) => {
        const pages = resizeIndependentPages(
          prev.textLayersByPage,
          editorSlotCount(prev.pageCount)
        );
        const current = pages[pageIndexToUpdate] ?? [];
        const incoming =
          typeof layersOrUpdater === "function"
            ? layersOrUpdater(current)
            : layersOrUpdater;
        const normalizedLayers =
          options?.applyLayout === false
            ? incoming
            : applySemanticPageLayout(incoming, pageIndexToUpdate);
        const nextPages = pages.map((pageLayers, idx) =>
          idx === pageIndexToUpdate ? normalizedLayers : pageLayers
        );
        const next = {
          ...prev,
          inputs: patchGlobalInputsFromPage(normalizedLayers, prev.inputs),
          textLayersByPage: nextPages,
        };
        saveSession(next);
        return next;
      });
    },
    []
  );

  /** PreviewCanvas / overlay edits — never restack via semantic layout. */
  const onPreviewTextLayersChange = useCallback(
    (pageIndexToUpdate: number, layers: TextLayer[]) => {
      updateTextLayersForPage(pageIndexToUpdate, layers, {
        applyLayout: false,
      });
    },
    [updateTextLayersForPage]
  );

  const updatePhotoLayersForPage = useCallback(
    (pageIndexToUpdate: number, layers: PrintPhotoLayer[]) => {
      setState((prev) => {
        const pages = resizePhotoPages(prev.photoLayersByPage, prev.pageCount);
        const nextPages = pages.map((pageLayers, idx) =>
          idx === pageIndexToUpdate ? layers : pageLayers
        );
        const next = { ...prev, photoLayersByPage: nextPages };
        saveSession(next);
        return next;
      });
    },
    []
  );

  const updateDecoLayersForPage = useCallback(
    (pageIndexToUpdate: number, layers: PrintDecoLayer[]) => {
      setState((prev) => {
        const pages = resizeDecoPages(prev.decoLayersByPage, prev.pageCount);
        const nextPages = pages.map((pageLayers, idx) =>
          idx === pageIndexToUpdate ? layers : pageLayers
        );
        const next = { ...prev, decoLayersByPage: nextPages };
        saveSession(next);
        return next;
      });
    },
    []
  );

  const updateBackgroundPanForPage = useCallback(
    (pageIndexToUpdate: number, pan: PrintBackgroundPan) => {
      setState((prev) => {
        const pages = resizeBackgroundPans(
          prev.backgroundPansByPage,
          prev.pageCount
        );
        const nextPages = pages.map((pagePan, idx) =>
          idx === pageIndexToUpdate ? pan : pagePan
        );
        const next = { ...prev, backgroundPansByPage: nextPages };
        saveSession(next);
        return next;
      });
    },
    []
  );

  /** Place vault/trained face as a safe-area photo layer (keep scenic bg if present). */
  const applyPhotoSubjectToCanvas = useCallback(
    async (item: PhotoVaultItem) => {
      const src = toDisplayImageSrc(item.src.trim());
      if (!src) return;
      const pageIndex = Math.max(0, currentPage - 1);
      const aspect = resolvePrintAspect(state.formatId, state.customSize);
      const stageW = 1080;
      const stageH = Math.max(1, Math.round(stageW / Math.max(aspect, 0.05)));
      const layer = await createPrintPhotoLayerFromSrc(src, {
        mode: item.photoKind === "cutout" ? "cutout" : "original",
        stageW,
        stageH,
        stackIndex: 0,
        id: LOOKBOOK_SUBJECT_LAYER_ID,
        lookbookPortraitScale: true,
      });
      setState((prev) => {
        // Dual-layer: replace subject only — do not wipe an existing scenic plate.
        const pages = resizePhotoPages(prev.photoLayersByPage, prev.pageCount);
        const nextPages = pages.map((p, i) => (i === pageIndex ? [layer] : p));
        const next = {
          ...prev,
          photoLayersByPage: nextPages,
        };
        saveSession(next);
        return next;
      });
      setActivePhotoLayerId(layer.id);
      setActiveDecoLayerId(null);
      setActiveTextLayerId(null);
    },
    [currentPage, saveSession, state.customSize, state.formatId]
  );

  const onInstallPhoto = useCallback(
    async (file: File, mode: PhotoKind) => {
      if (productId === "photo") {
        if (!isAllowedPrintPhotoFile(file)) {
          throw new Error("JPG, PNG, WebP 이미지만 업로드할 수 있습니다.");
        }
        let src: string;
        try {
          src = await blobToCompressedDataUrl(file);
        } catch {
          src = await readFileAsDataUrl(file);
        }
        let photoKind: PhotoKind = mode;
        if (mode === "cutout") {
          const cutoutHttps = await processSubjectViaApi(toRawImageUrl(src));
          src = toDisplayImageSrc(cutoutHttps);
          photoKind = "cutout";
        }
        // Upload vault only — canvas placement happens on user pick / train.
        pushUploadVaultItem({
          src,
          label: file.name?.replace(/\.[^.]+$/, "") || "upload",
          photoKind,
        });
        return;
      }

      const pageIndex = Math.max(0, currentPage - 1);
      const aspect = resolvePrintAspect(state.formatId, state.customSize);
      const stageW = 1080;
      const stageH = Math.max(1, Math.round(stageW / Math.max(aspect, 0.05)));
      const stackIndex = photoLayersByPage[pageIndex]?.length ?? 0;
      const layer = await createPrintPhotoLayerFromFile(file, {
        mode,
        stageW,
        stageH,
        stackIndex,
      });
      updatePhotoLayersForPage(pageIndex, [
        ...(photoLayersByPage[pageIndex] ?? []),
        layer,
      ]);
      setActivePhotoLayerId(layer.id);
      setActiveTextLayerId(null);
      setActiveDecoLayerId(null);
    },
    [
      currentPage,
      photoLayersByPage,
      productId,
      state.customSize,
      state.formatId,
      updatePhotoLayersForPage,
    ]
  );

  const onPhotoTrainedReady = useCallback(
    async (item: PhotoVaultItem) => {
      await applyPhotoSubjectToCanvas(item);
    },
    [applyPhotoSubjectToCanvas]
  );

  const onCanvasSymbolPick = useCallback(
    (symbol: string) => {
      const pageIndex = Math.max(0, currentPage - 1);
      const aspect = resolvePrintAspect(state.formatId, state.customSize);
      const stage = referencePrintStageSize(aspect);
      const stackIndex = decoLayersByPage[pageIndex]?.length ?? 0;
      try {
        const layer = createSymbolLayer(
          symbol,
          stage.w,
          stage.h,
          stackIndex
        );
        updateDecoLayersForPage(pageIndex, [
          ...(decoLayersByPage[pageIndex] ?? []),
          layer,
        ]);
        setActiveDecoLayerId(layer.id);
        setActiveTextLayerId(null);
        setActivePhotoLayerId(null);
      } catch {
        /* empty symbol */
      }
    },
    [
      currentPage,
      decoLayersByPage,
      state.customSize,
      state.formatId,
      updateDecoLayersForPage,
    ]
  );

  const onDecoCatalogPick = useCallback(
    (decoId: string) => {
      const pageIndex = Math.max(0, currentPage - 1);
      const aspect = resolvePrintAspect(state.formatId, state.customSize);
      const stage = referencePrintStageSize(aspect);
      const stackIndex = decoLayersByPage[pageIndex]?.length ?? 0;
      try {
        const layer = createDecoLayer(
          decoId,
          stage.w,
          stage.h,
          stackIndex
        );
        updateDecoLayersForPage(pageIndex, [
          ...(decoLayersByPage[pageIndex] ?? []),
          layer,
        ]);
        setActiveDecoLayerId(layer.id);
        setActiveTextLayerId(null);
        setActivePhotoLayerId(null);
      } catch {
        /* unknown catalog id */
      }
    },
    [
      currentPage,
      decoLayersByPage,
      state.customSize,
      state.formatId,
      updateDecoLayersForPage,
    ]
  );

  const onLayerTextChange = useCallback(
    (layerId: string, text: string) => {
      updateTextLayersForPage(
        editorPageIndex,
        (current) =>
          current.map((layer) =>
            layer.id === layerId ? { ...layer, text } : layer
          ),
        { applyLayout: false }
      );
    },
    [editorPageIndex, updateTextLayersForPage]
  );

  const onAddLayerAfter = useCallback(
    (nextLayers: TextLayer[]) => {
      updateTextLayersForPage(editorPageIndex, () => nextLayers, {
        applyLayout: false,
      });
    },
    [editorPageIndex, updateTextLayersForPage]
  );

  const onDeleteLayer = useCallback(
    (layerId: string) => {
      updateTextLayersForPage(
        editorPageIndex,
        (current) => removeTextLayer(current, layerId),
        { applyLayout: false }
      );
      if (activeTextLayerId === layerId) setActiveTextLayerId(null);
    },
    [activeTextLayerId, editorPageIndex, updateTextLayersForPage]
  );

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
      saveSession(next);
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
      const next = markSpecPick(
        mergeInvitationBlueprint(prev, { formatId }),
        "format"
      );
      saveSession(next);
      const aspect = resolvePrintAspect(next.formatId, next.customSize);
      void refitPhotoLayersByPageForAspect(
        next.photoLayersByPage,
        next.pageCount,
        aspect
      ).then((photoLayersByPage) => {
        setState((cur) => {
          const patched = { ...cur, photoLayersByPage };
          saveSession(patched);
          return patched;
        });
      });
      return next;
    });
  };

  const onCustomSizeApply = (customSize: PrintCustomSize) => {
    setState((prev) => {
      const next = markSpecPick(
        mergeInvitationBlueprint(prev, { formatId: "free", customSize }),
        "format"
      );
      saveSession(next);
      const aspect = resolvePrintAspect(next.formatId, next.customSize);
      void refitPhotoLayersByPageForAspect(
        next.photoLayersByPage,
        next.pageCount,
        aspect
      ).then((photoLayersByPage) => {
        setState((cur) => {
          const patched = { ...cur, photoLayersByPage };
          saveSession(patched);
          return patched;
        });
      });
      return next;
    });
  };

  const onUseChange = (useId: PrintUseId) => {
    setState((prev) => {
      let next = markSpecPick(
        mergeInvitationBlueprint(prev, { useId }),
        "use"
      );
      if (productId === "photo" && useId === "id-photo") {
        next = markSpecPick(
          {
            ...next,
            visualStyle: {
              ...next.visualStyle,
              imageStyleId: ID_PHOTO_STYLE_ID,
            },
          },
          "style"
        );
      } else if (
        productId === "photo" &&
        useId !== "id-photo" &&
        next.visualStyle.imageStyleId === ID_PHOTO_STYLE_ID
      ) {
        // Leaving ID-photo use clears the matching style so examples leave ID filter.
        next = markSpecPick(
          {
            ...next,
            visualStyle: { ...next.visualStyle, imageStyleId: null },
          },
          "style",
          false
        );
      }
      saveSession(next);
      return next;
    });
  };

  const onPageCountChange = (pageCount: PrintPageCount) => {
    setState((prev) => {
      const next = markSpecPick(
        mergeInvitationBlueprint(prev, { pageCount }),
        "pages"
      );
      saveSession(next);
      return next;
    });
  };

  const onVisualStyleChange = (visualStyle: PrintWizardState["visualStyle"]) => {
    setState((prev) => {
      const hasStyle = Boolean(
        visualStyle.imageStyleId || visualStyle.moodStyleId
      );
      let next = markSpecPick({ ...prev, visualStyle }, "style", hasStyle);
      if (
        productId === "photo" &&
        visualStyle.imageStyleId === ID_PHOTO_STYLE_ID
      ) {
        next = markSpecPick(
          mergeInvitationBlueprint(next, { useId: "id-photo" }),
          "use"
        );
      } else if (
        productId === "photo" &&
        prev.visualStyle.imageStyleId === ID_PHOTO_STYLE_ID &&
        visualStyle.imageStyleId !== ID_PHOTO_STYLE_ID &&
        next.useId === "id-photo"
      ) {
        // Leaving ID-photo style clears matching use so examples leave ID filter.
        next = markSpecPick(
          mergeInvitationBlueprint(next, { useId: "lookbook" }),
          "use"
        );
      }
      saveSession(next);
      return next;
    });
  };

  const onHideFoldGuides = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, foldGuidesHidden: true };
      saveSession(next);
      return next;
    });
  }, []);

  const resetWorkspace = useCallback(() => {
    const next = createDefaultState();
    next.textLayersByPage = resizeIndependentPages(
      undefined,
      editorSlotCount(next.pageCount)
    ).map((page, i) => applySemanticPageLayout(page, i));
    next.photoLayersByPage = [];
    next.decoLayersByPage = [];
    next.backgroundPansByPage = [];
    clearSession();
    saveSession(next);
    setState(next);
    setGenerating(false);
    setGeneratingKind(null);
    setDraftBusy(false);
    setFinishBusy(false);
    setCurrentPage(1);
    setActiveTextLayerId(null);
    setActivePhotoLayerId(null);
    setActiveDecoLayerId(null);
    setLayerModalPage(null);
    setWorkspaceEpoch((n) => n + 1);
    useCanvasStore.getState().resetDocument();
  }, [clearSession, createDefaultState, saveSession]);

  /** Photo: clear canvas images only — vaults & recent stay intact. */
  const clearCanvasImagesOnly = useCallback(() => {
    setState((prev) => {
      const next = {
        ...prev,
        backgroundUrl: null as string | null,
        backgroundUrls: Array.from({ length: prev.pageCount }, () => ""),
        photoLayersByPage: Array.from({ length: prev.pageCount }, () => []),
        decoLayersByPage: Array.from({ length: prev.pageCount }, () => []),
        backgroundPansByPage: resizeBackgroundPans(undefined, prev.pageCount),
      };
      saveSession(next);
      return next;
    });
    setActivePhotoLayerId(null);
    setActiveDecoLayerId(null);
    setActiveTextLayerId(null);
    showToast(
      "캔버스 이미지를 비웠습니다. 저장소·최근 파일은 유지됩니다.",
      "success"
    );
  }, [saveSession, showToast]);

  /** Drop canvas plate/layers that match a deleted vault src. */
  const removeCanvasMatchingVaultSrc = useCallback(
    (item: PhotoVaultItem) => {
      const src = toDisplayImageSrc(item.src.trim());
      if (!src) return;
      setState((prev) => {
        const urls = (
          prev.backgroundUrls?.length
            ? prev.backgroundUrls
            : Array.from({ length: prev.pageCount }, (_, i) =>
                i === 0 ? prev.backgroundUrl || "" : ""
              )
        ).map((u) => (u && toDisplayImageSrc(u) === src ? "" : u || ""));
        const pages = resizePhotoPages(
          prev.photoLayersByPage,
          prev.pageCount
        ).map((page) =>
          page.filter((layer) => toDisplayImageSrc(layer.src) !== src)
        );
        const next = {
          ...prev,
          backgroundUrls: urls,
          backgroundUrl: urls[0] || null,
          photoLayersByPage: pages,
        };
        saveSession(next);
        return next;
      });
      setActivePhotoLayerId(null);
    },
    [saveSession]
  );

  const onBgKeywordChange = (bgKeyword: string) => {
    setState((prev) => {
      const next = { ...prev, bgKeyword };
      saveSession(next);
      return next;
    });
  };

  const onBgPresetPick = (id: BgPresetId) => {
    const preset = fieldById(id);
    if (!preset) return;
    setState((prev) => {
      const next = applyAutoLayoutState(prev, { bgPresetId: id });
      saveSession(next);
      return next;
    });
  };

  const onPromptPresetPick = (id: string, prompt: string) => {
    patch({ selectedPromptPresetId: id, mainPrompt: prompt });
  };

  const onMainPromptChange = (mainPrompt: string) => {
    patch({ mainPrompt, selectedPromptPresetId: null });
  };

  /**
   * Dual-layer commit: scenic plate stays fixed unless scenicUrl is provided;
   * subject is always an independent cutout layer with bbox handles.
   */
  const commitPhotoLookbookDualLayer = useCallback(
    (opts: {
      pageIndex: number;
      /** undefined = keep existing scenic; string = set; null = clear */
      scenicUrl?: string | null;
      subjectLayer: PrintPhotoLayer;
    }) => {
      const { pageIndex, subjectLayer } = opts;
      flushSync(() => {
        setState((prev) => {
          const pageCount = Math.max(1, prev.pageCount);
          let urls = Array.from({ length: pageCount }, (_, i) =>
            prev.backgroundUrls?.[i] ||
            (i === 0 ? prev.backgroundUrl || "" : "")
          );

          if (opts.scenicUrl !== undefined) {
            const displayScenic =
              opts.scenicUrl === null
                ? ""
                : (() => {
                    const raw = opts.scenicUrl!.trim();
                    if (!raw) return "";
                    const proxied = toDisplayImageSrc(raw);
                    return proxied.includes("?")
                      ? `${proxied}&_cb=${Date.now()}`
                      : `${proxied}?_cb=${Date.now()}`;
                  })();
            urls = urls.map((u, i) => (i === pageIndex ? displayScenic : u));
          }

          const pages = resizePhotoPages(prev.photoLayersByPage, pageCount);
          const nextPages = pages.map((p, i) =>
            i === pageIndex ? [subjectLayer] : p
          );

          const next: PrintWizardState = {
            ...prev,
            backgroundUrls: urls,
            backgroundUrl: pageIndex === 0 ? urls[0] || null : prev.backgroundUrl,
            photoLayersByPage: nextPages,
            decoLayersByPage: Array.from({ length: pageCount }, () => []),
          };
          saveSession(next);
          return next;
        });
        setActivePhotoLayerId(subjectLayer.id);
        setActiveDecoLayerId(null);
        setActiveTextLayerId(null);
        setLookbookPlateEpoch((n) => n + 1);
      });
    },
    [saveSession]
  );

  const resolveLookbookAspect = (snap: PrintWizardState) => {
    const format = formatById(snap.formatId);
    const aspectRatio =
      snap.formatId === "free" && snap.customSize
        ? `${snap.customSize.width}:${snap.customSize.height}`
        : format.label.includes(":")
          ? format.label
          : snap.formatId === "id-photo"
            ? "3.5:4.5"
            : snap.formatId.startsWith("a")
              ? "3:4"
              : "9:16";
    return {
      aspect: resolvePrintAspect(snap.formatId, snap.customSize),
      aspectRatio,
      styleOpts: {
        aspectRatio,
        imageStyleId: snap.visualStyle.imageStyleId,
        moodStyleId: snap.visualStyle.moodStyleId,
      },
    };
  };

  /** Photo: ID solid/empty bg OR full base scene (place + posed identity). */
  const onGenerateLookbookBackground = async (): Promise<boolean> => {
    if (generating) return false;
    const ui = photoInpaintUi(locale);
    const snap = stateRef.current;
    const prompt = snap.bgKeyword.trim();
    if (!prompt) {
      showToast(ui.needBgPrompt, "error");
      return false;
    }
    const pageIndex = Math.max(0, currentPage - 1);
    const layers =
      resizePhotoPages(snap.photoLayersByPage, snap.pageCount)[pageIndex] ?? [];
    const subjectLayer = layers[0] ?? null;
    const hasSubject = Boolean(subjectLayer?.src?.trim());
    const idMode = isIdPhotoLookbookMode({
      useId: snap.useId,
      imageStyleId: snap.visualStyle.imageStyleId,
    });
    const solidColor = parseIdPhotoBackgroundColor(prompt);
    const useSolid = shouldUseSolidIdBackground({
      useId: snap.useId,
      imageStyleId: snap.visualStyle.imageStyleId,
      bgPrompt: prompt,
    });

    setGenerating(true);
    setGeneratingKind("background");
    showToast(
      idMode || solidColor
        ? "원본 인물 고정 · 배경만 교체 중…"
        : "초기 화보 씬(배경+인물 포즈) 생성 중…",
      "info"
    );
    try {
      const { aspect, styleOpts } = resolveLookbookAspect(snap);
      const stage = referencePrintStageSize(aspect);

      // ── ID / solid studio: keep original silhouette, swap backdrop only ──
      if (useSolid || idMode) {
        let scenicHttps: string;
        if (useSolid) {
          const color = solidColor || "#FFFFFF";
          scenicHttps = await createSolidBackgroundHttps({
            color,
            width: stage.w,
            height: stage.h,
          });
        } else {
          scenicHttps = await generateLookbookScenicBackground({
            prompt: [
              prompt,
              ID_PHOTO_STUDIO_LOCK,
              "Empty studio backdrop only — no people, no faces.",
            ].join(" "),
            ...styleOpts,
          });
        }

        const identity =
          resolvePhotoIdentitySrc(layers) || subjectLayer?.src?.trim() || null;
        if (!identity) {
          window.alert(ui.needFace);
          return false;
        }

        const cutoutHttps = await cutoutOriginalIdentityOnly(identity);
        const nextLayer =
          hasSubject && subjectLayer
            ? await replaceSubjectLayerCutout(
                subjectLayer,
                cutoutHttps,
                stage.w,
                stage.h
              )
            : await createLookbookSubjectLayer(
                cutoutHttps,
                stage.w,
                stage.h,
                LOOKBOOK_SUBJECT_LAYER_ID
              );

        commitPhotoLookbookDualLayer({
          pageIndex,
          scenicUrl: scenicHttps,
          subjectLayer: nextLayer,
        });
        showToast(
          "배경만 교체했습니다. 원본 인물은 그대로입니다.",
          "success"
        );
        return true;
      }

      // ── Lookbook base scene: cohesive place + posed person, then dual-layer ──
      const identity =
        resolvePhotoIdentitySrc(layers) || subjectLayer?.src?.trim() || null;
      if (!identity) {
        window.alert(ui.needFace);
        return false;
      }

      const { scenicUrl, cutoutUrl } = await generateLookbookBaseSceneDualLayer({
        prompt,
        identityUrl: identity,
        ...styleOpts,
      });

      const nextLayer =
        hasSubject && subjectLayer
          ? await replaceSubjectLayerCutout(
              subjectLayer,
              cutoutUrl,
              stage.w,
              stage.h
            )
          : await createLookbookSubjectLayer(
              cutoutUrl,
              stage.w,
              stage.h,
              LOOKBOOK_SUBJECT_LAYER_ID
            );

      commitPhotoLookbookDualLayer({
        pageIndex,
        scenicUrl,
        subjectLayer: nextLayer,
      });
      showToast(
        "초기 화보 씬이 준비되었습니다. 하단에서 인물 수정을 이어갈 수 있습니다.",
        "success"
      );
      return true;
    } catch (err) {
      console.error("[photo-wizard] background generate failed", err);
      window.alert(
        err instanceof Error
          ? err.message
          : "배경 생성에 실패했습니다. 잠시 후 다시 시도해 주세요."
      );
      return false;
    } finally {
      setGenerating(false);
      setGeneratingKind(null);
    }
  };

  /** Photo: subject edit only (requires scenic plate). */
  const onGenerateLookbookSubject = async (): Promise<boolean> => {
    if (generating) return false;
    const ui = photoInpaintUi(locale);
    const snap = stateRef.current;
    const prompt = snap.mainPrompt.trim();
    if (!prompt) {
      showToast(ui.needSubjectPrompt, "error");
      return false;
    }
    const pageIndex = Math.max(0, currentPage - 1);
    const plateUrl = pageBackgroundUrl(
      snap.backgroundUrls,
      snap.backgroundUrl,
      pageIndex
    );
    const layers =
      resizePhotoPages(snap.photoLayersByPage, snap.pageCount)[pageIndex] ?? [];
    const subjectLayer = layers[0] ?? null;
    const hasScenic = Boolean(plateUrl?.trim());
    const hasSubject = Boolean(subjectLayer?.src?.trim());

    if (!hasScenic) {
      showToast(ui.needBgFirst, "error");
      return false;
    }

    setGenerating(true);
    setGeneratingKind("subject");
    showToast("배경은 고정 · 인물만 수정 중…", "info");
    try {
      const { aspect, styleOpts } = resolveLookbookAspect(snap);
      const stage = referencePrintStageSize(aspect);

      if (hasSubject && subjectLayer) {
        const result = await runPhotoInpaintGenerate({
          prompt,
          backgroundUrls: snap.backgroundUrls,
          backgroundUrl: snap.backgroundUrl,
          photoLayers: layers,
          pageIndex,
          stageW: stage.w,
          stageH: stage.h,
          ...styleOpts,
        });
        const cutoutHttps = await cutoutLookbookSubject(result.imageUrl);
        const nextLayer = await replaceSubjectLayerCutout(
          subjectLayer,
          cutoutHttps,
          stage.w,
          stage.h
        );
        commitPhotoLookbookDualLayer({
          pageIndex,
          subjectLayer: nextLayer,
        });
        showToast("인물 레이어만 교체했습니다. 배경은 그대로입니다.", "success");
        return true;
      }

      // Scenic exists but no subject layer yet (or legacy plate).
      const identity = resolvePhotoIdentitySrc(layers);
      if (!identity) {
        window.alert(ui.needFace);
        return false;
      }

      if (!hasSubject && plateUrl) {
        // Ensure plate is clean scenic; then place new subject.
        const [scenicHttps, cutoutHttps] = await Promise.all([
          cleanScenicBackgroundFromPlate({
            plateUrl,
            ...styleOpts,
          }),
          generateLookbookSubjectCutout({
            prompt,
            identityUrl: identity,
            ...styleOpts,
          }),
        ]);
        const nextLayer = await createLookbookSubjectLayer(
          cutoutHttps,
          stage.w,
          stage.h,
          LOOKBOOK_SUBJECT_LAYER_ID
        );
        commitPhotoLookbookDualLayer({
          pageIndex,
          scenicUrl: scenicHttps,
          subjectLayer: nextLayer,
        });
        showToast("인물 레이어를 배치했습니다.", "success");
        return true;
      }

      const cutoutHttps = await generateLookbookSubjectCutout({
        prompt,
        identityUrl: identity,
        ...styleOpts,
      });
      const nextLayer = await createLookbookSubjectLayer(
        cutoutHttps,
        stage.w,
        stage.h,
        LOOKBOOK_SUBJECT_LAYER_ID
      );
      commitPhotoLookbookDualLayer({
        pageIndex,
        subjectLayer: nextLayer,
      });
      showToast("인물 레이어를 배치했습니다.", "success");
      return true;
    } catch (err) {
      console.error("[photo-wizard] subject generate failed", err);
      const msg = err instanceof Error ? err.message : "";
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code?: string }).code)
          : msg;
      if (
        code === "photo_identity_missing" ||
        msg === "photo_identity_missing"
      ) {
        window.alert(ui.needFace);
      } else if (
        code === "photo_scene_missing" ||
        msg === "photo_scene_missing"
      ) {
        window.alert(ui.needScene);
      } else {
        window.alert(
          err instanceof Error
            ? err.message
            : "인물 수정에 실패했습니다. 잠시 후 다시 시도해 주세요."
        );
      }
      return false;
    } finally {
      setGenerating(false);
      setGeneratingKind(null);
    }
  };

  const onGenerateBackground = async (): Promise<boolean> => {
    if (generating) return false;

    if (productId === "photo") {
      return onGenerateLookbookBackground();
    }

    const keywords = Array.from({ length: state.pageCount }, (_, i) =>
      buildPagePrintAiContext(state, i)
    );
    if (!keywords[0]) return false;
    setGenerating(true);
    try {
      const format = formatById(state.formatId);
      const use = useById(state.useId);
      const urls = await generatePrintBackgroundPages({
        keyword: keywords[0],
        keywords,
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
      setState((prev) => {
        const next = {
          ...prev,
          backgroundUrls: urls,
          backgroundUrl: urls[0] ?? null,
          backgroundPansByPage: resizeBackgroundPans(undefined, prev.pageCount),
        };
        saveSession(next);
        return next;
      });
      return urls.some(Boolean);
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
      setGeneratingKind(null);
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
      // Auto-save a temporary draft snapshot before advancing
      try { saveDraft(next); } catch { /* non-critical */ }
      saveSession(next);
      return next;
    });
    setFinishBusy(false);
  };

  const onRestoreDraft = useCallback((restoredState: PrintWizardState) => {
    const next = {
      ...restoredState,
      wizardStep: 1 as const,
    };
    saveSession(next);
    setState(next);
    setCurrentPage(1);
    setActiveTextLayerId(null);
    setActivePhotoLayerId(null);
    setActiveDecoLayerId(null);
    setLayerModalPage(null);
  }, []);

  const photoActiveBg = pageBackgroundUrl(
    state.backgroundUrls,
    state.backgroundUrl,
    Math.max(0, currentPage - 1)
  );
  const photoAspect = resolvePrintAspect(state.formatId, state.customSize);
  const {
    busy: photoExportBusy,
    downloadWithProject,
    premiumModal: photoPremiumModal,
  } = usePrintWizardExport({
    activeBg: photoActiveBg,
    customSize: state.customSize,
    aspect: photoAspect,
    titlePreview: state.inputs.title || cs.photoTitle,
    studioPath,
    pendingProjectKey,
    recentNamespace,
    overlayLayers: (() => {
      const pageIndex = Math.max(0, currentPage - 1);
      return resolvePageTextLayersForExport(
        textLayersByPage,
        pageIndex,
        state.inputs,
        state.pageCount
      );
    })(),
    resolveExportImage:
      productId === "photo"
        ? async (quality) => {
            const pageIndex = Math.max(0, currentPage - 1);
            const exportState = {
              ...state,
              textLayersByPage: textLayersByPage.map((page, i) =>
                resolvePageTextLayersForExport(
                  textLayersByPage,
                  i,
                  state.inputs,
                  state.pageCount
                )
              ),
            };
            if (!photoLookbookHasExportableFrame(exportState)) {
              throw new Error("nothing_to_export");
            }
            return compositePhotoLookbookBlob({
              state: exportState,
              pageIndex,
              quality,
            });
          }
        : async (quality) => {
            // Print Step-1 downloads (when present) — same live layers as PreviewCanvas.
            const pageIndex = Math.max(0, currentPage - 1);
            const exportState = {
              ...state,
              textLayersByPage: textLayersByPage.map((_, i) =>
                resolvePageTextLayersForExport(
                  textLayersByPage,
                  i,
                  state.inputs,
                  state.pageCount
                )
              ),
            };
            if (!photoLookbookHasExportableFrame(exportState)) {
              throw new Error("nothing_to_export");
            }
            return compositePhotoLookbookBlob({
              state: exportState,
              pageIndex,
              quality,
            });
          },
    buildLookbookSnapshot: () =>
      capturePhotoLookbookSnapshot({
        ...state,
        textLayersByPage,
        photoLayersByPage,
        decoLayersByPage,
      }),
  });

  const onOpenRecentProject = useCallback(
    (project: StudioCanvasProjectV1) => {
      if (productId === "photo" && isPhotoLookbookSnapshot(project.lookbook)) {
        const { wizard } = applyPhotoLookbookSnapshot(project.lookbook);
        skipAutoLayoutOnceRef.current = true;
        // Preserve saved geometry verbatim — no applySemanticPageLayout.
        const next = {
          ...wizard,
          pageCount: 1 as const,
          formatId: coercePhotoFormatId(wizard.formatId),
          useId: coercePhotoUseId(wizard.useId),
          textLayersByPage: resizeIndependentPages(
            wizard.textLayersByPage,
            editorSlotCount(1)
          ),
          photoLayersByPage: wizard.photoLayersByPage,
          backgroundUrls: wizard.backgroundUrls,
          backgroundPansByPage: wizard.backgroundPansByPage,
          // Keep current step — never bounce to a sub-studio route.
          wizardStep: (state.wizardStep ?? 1) as 1 | 2,
        };
        saveSession(next);
        setState(next);
        setCurrentPage(1);
        setActiveTextLayerId(null);
        setActivePhotoLayerId(null);
        setActiveDecoLayerId(null);
        setLayerModalPage(null);
        setWorkspaceEpoch((n) => n + 1);
        showToast(
          "최근 파일을 불러와 캔버스·업로드·학습 저장소를 복구했습니다.",
          "success"
        );
        return;
      }

      // Print (and photo without lookbook): apply onto current wizard canvas.
      skipAutoLayoutOnceRef.current = true;
      const pageIndex = Math.max(0, currentPage - 1);
      const layers = (project.studio.overlayLayers || []).map((l) => ({
        ...l,
        ranges: l.ranges?.map((r) => ({ ...r })) ?? [],
      }));
      const slots = editorSlotCount(state.pageCount);
      const textPages = resizeIndependentPages(
        state.textLayersByPage,
        slots
      );
      if (layers.length) {
        textPages[pageIndex] = layers;
      }

      const bgState = backgroundStateFromProject(
        project,
        state.pageCount,
        pageIndex
      );
      const photoPages = resizePhotoPages(
        photoLayersByPageFromProject(project, state.pageCount, pageIndex),
        state.pageCount
      );
      const decoFromProject = decoLayersByPageFromProject(
        project,
        state.pageCount
      );
      const decoPages = decoFromProject
        ? resizeDecoPages(decoFromProject, state.pageCount)
        : resizeDecoPages(state.decoLayersByPage, state.pageCount);

      const next = {
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
        wizardStep: (state.wizardStep ?? 1) as 1 | 2,
      };
      saveSession(next);
      setState(next);
      setWorkspaceEpoch((n) => n + 1);
      showToast(
        "최근 수정파일을 불러와 편집 상태를 복원했습니다.",
        "success"
      );
    },
    [
      currentPage,
      productId,
      saveSession,
      showToast,
      state,
    ]
  );

  if (wizardStep === 2) {
    return (
      <div className="h-full min-h-0 overflow-hidden">
        <PrintWizardEditStage
          state={state}
          currentPage={currentPage}
          onCurrentPageChange={setCurrentPage}
          textLayersByPage={textLayersByPage}
          onTextLayersChange={updateTextLayersForPage}
          photoLayersByPage={photoLayersByPage}
          onPhotoLayersChange={updatePhotoLayersForPage}
          decoLayersByPage={
            productId === "photo" ? undefined : decoLayersByPage
          }
          onDecoLayersChange={
            productId === "photo" ? undefined : updateDecoLayersForPage
          }
          onDecoCatalogPick={onDecoCatalogPick}
          onCanvasSymbolPick={onCanvasSymbolPick}
          onBackgroundPanChange={updateBackgroundPanForPage}
          activePhotoLayerId={activePhotoLayerId}
          onActivePhotoLayerChange={setActivePhotoLayerId}
          activeDecoLayerId={productId === "photo" ? null : activeDecoLayerId}
          onActiveDecoLayerChange={
            productId === "photo" ? undefined : setActiveDecoLayerId
          }
          onInstallPhoto={onInstallPhoto}
          activeTextLayerId={activeTextLayerId}
          onActiveTextLayerChange={setActiveTextLayerId}
          onHideFoldGuides={onHideFoldGuides}
          onResetWorkspace={
            productId === "photo" ? undefined : resetWorkspace
          }
          onClearCanvasImages={
            productId === "photo" ? clearCanvasImagesOnly : undefined
          }
          studioPath={studioPath}
          pendingProjectKey={pendingProjectKey}
          recentNamespace={recentNamespace}
          panelTitle={panelTitle}
          isPhotoLookbook={productId === "photo"}
          onOpenRecentProject={onOpenRecentProject}
        />
      </div>
    );
  }

  const wizardTitle =
    productId === "photo" ? t.hero.ctaPhotoGenerator : t.hero.ctaPrintSmartForm;
  const wizardSubtitle =
    productId === "photo" ? t.hero.photoWizardStep2 : t.hero.printWizardStep2;
  const isPhotoLayout = productId === "photo";
  const previewPhotoLayers = photoLayersByPage;
  const previewOnPhotoLayersChange = updatePhotoLayersForPage;

  const specsPanel = (
    <SpecSettingsPanel
      key={workspaceEpoch}
      productId={productId}
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
      generatingKind={generatingKind}
      onFormatChange={onFormatChange}
      onCustomSizeApply={onCustomSizeApply}
      onUseChange={onUseChange}
      onPageCountChange={onPageCountChange}
      onBgKeywordChange={onBgKeywordChange}
      onBgPresetPick={onBgPresetPick}
      onGenerateBackground={() => void onGenerateBackground()}
      onGenerateSubject={() => void onGenerateLookbookSubject()}
      onPromptPresetPick={onPromptPresetPick}
      onMainPromptChange={onMainPromptChange}
      onVisualStyleChange={onVisualStyleChange}
    />
  );

  const step1PageLayers =
    textLayersByPage[Math.max(0, currentPage - 1)] ?? [];

  const step1TextLayerList = (
    <div className="rounded-xl border border-slate-800 bg-[#0B0F19]/80 p-2">
      <p className="mb-1.5 px-0.5 text-[11px] font-semibold text-slate-400">
        {cs.textLayers}
      </p>
      <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
        {step1PageLayers.map((layer, idx) => {
          const active = activeTextLayerId === layer.id;
          return (
            <button
              key={layer.id}
              type="button"
              onClick={() => {
                setActiveTextLayerId(layer.id);
                setActivePhotoLayerId(null);
                setActiveDecoLayerId(null);
              }}
              className={`flex min-w-0 items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition ${
                active
                  ? "border-indigo-400 bg-indigo-500/15 ring-1 ring-indigo-400/40"
                  : "border-slate-800 bg-[#121824] hover:border-slate-600"
              }`}
            >
              <span className="shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200">
                {idx + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-[11px] text-slate-200">
                {layer.text.trim() || cs.layerPlaceholder}
              </span>
              <span className="shrink-0 tabular-nums text-[10px] text-slate-500">
                {Math.round(layer.fontSize || 0)}px
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const formPanel = (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {step1TextLayerList}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SmartInputForm
          key={workspaceEpoch}
          currentPage={layerModalPage ?? currentPage}
          onSelectPage={selectWizardPage}
          wizardMode
          draftBusy={draftBusy}
          finishBusy={finishBusy}
          draftReady={state.draftReady === true}
          onGenerateDraft={() => void onGenerateDraft()}
          onFinishStep={onFinishStep}
          onRestoreDraft={onRestoreDraft}
          listDrafts={(draftStorageProp ?? product.drafts).listDrafts}
          loadDraft={(draftStorageProp ?? product.drafts).loadDraft}
          draftsChangedEvent={draftChangedEvent}
          showWizardFinishAction={!isPhotoLayout}
        />
      </div>
    </div>
  );

  const photoMiddlePanel = (
    <FaceVaultPanel
      key={workspaceEpoch}
      onTrainedReady={onPhotoTrainedReady}
      onInstallFile={onInstallPhoto}
      onVaultItemRemoved={removeCanvasMatchingVaultSrc}
    />
  );

  const photoRightPanel = (
    <div
      data-wizard-form
      className="relative z-[500] flex h-full min-h-0 flex-col gap-2 pointer-events-auto pb-4"
    >
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain">
        {specsPanel}
        {step1TextLayerList}
      </div>
      <section className="shrink-0 rounded-2xl border border-slate-800 bg-[#121824] p-3 shadow-[0_8px_32px_rgba(0,0,0,0.35)] sm:p-3.5">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={
              photoExportBusy ||
              generating ||
              draftBusy ||
              !canDownloadStandard
            }
            onClick={() => void downloadWithProject("standard")}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 px-3 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-teal-900/25 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {photoExportBusy ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Download className="h-4 w-4 shrink-0" aria-hidden />
            )}
            <span className="min-w-0 text-center text-[11px] font-bold leading-tight [word-break:keep-all] sm:text-[13px]">
              {standardLabel}
            </span>
          </button>
          <button
            type="button"
            disabled={
              photoExportBusy || generating || draftBusy || !canDownloadHigh
            }
            onClick={() => void downloadWithProject("high")}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-500 px-3 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-indigo-900/25 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {photoExportBusy ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Download className="h-4 w-4 shrink-0" aria-hidden />
            )}
            <span className="min-w-0 text-center text-[11px] font-bold leading-tight [word-break:keep-all] sm:text-[13px]">
              {highLabel}
            </span>
          </button>
        </div>
        <p className="mt-1.5 truncate px-0.5 text-center text-[11px] font-medium leading-none text-slate-300 [word-break:keep-all]">
          다운로드 시 완성본과 수정용 파일(.sca)이 함께 저장/최근파일불러오기에도 저장
        </p>
      </section>
      {photoPremiumModal}
    </div>
  );

  return (
    <>
    <Step2Layout
      title={wizardTitle}
      subtitle={wizardSubtitle}
      preview={
        <PreviewCanvas
          formatId={state.formatId}
          useId={state.useId}
          pageCount={state.pageCount}
          customSize={state.customSize}
          backgroundUrl={state.backgroundUrl}
          backgroundUrls={state.backgroundUrls}
          backgroundPansByPage={backgroundPansByPage}
          onBackgroundPanChange={updateBackgroundPanForPage}
          generating={generating || draftBusy}
          studioPath={studioPath}
          pendingProjectKey={pendingProjectKey}
          recentNamespace={recentNamespace}
          panelTitle={panelTitle}
          onOpenRecentProject={onOpenRecentProject}
          datePreview={state.inputs.date}
          titlePreview={state.inputs.title}
          subtitlePreview={state.inputs.subtitle}
          locationPreview={state.inputs.location}
          organizerPreview={state.inputs.organizer}
          programsPreview={state.inputs.programs}
          overlayLayersByPage={textLayersByPage.slice(0, state.pageCount)}
          onOverlayLayersChange={onPreviewTextLayersChange}
          photoLayersByPage={previewPhotoLayers}
          onPhotoLayersChange={previewOnPhotoLayersChange}
          activePhotoLayerId={activePhotoLayerId}
          onActivePhotoLayerChange={setActivePhotoLayerId}
          decoLayersByPage={isPhotoLayout ? undefined : decoLayersByPage}
          onDecoLayersChange={
            isPhotoLayout ? undefined : updateDecoLayersForPage
          }
          activeDecoLayerId={isPhotoLayout ? null : activeDecoLayerId}
          onActiveDecoLayerChange={
            isPhotoLayout ? undefined : setActiveDecoLayerId
          }
          onInstallPhoto={onInstallPhoto}
          activeTextLayerId={activeTextLayerId}
          onActiveTextLayerChange={setActiveTextLayerId}
          currentPage={currentPage}
          onCurrentPageChange={setCurrentPage}
          foldGuidesHidden={state.foldGuidesHidden}
          onHideFoldGuides={onHideFoldGuides}
          onResetWorkspace={isPhotoLayout ? undefined : resetWorkspace}
          onClearCanvasImages={
            isPhotoLayout ? clearCanvasImagesOnly : undefined
          }
          toolbarMode={isPhotoLayout ? "no-upload" : "full"}
          toolbarRoomy={isPhotoLayout}
          backgroundFit="cover"
          contentEpoch={isPhotoLayout ? lookbookPlateEpoch : 0}
        />
      }
      specs={isPhotoLayout ? photoMiddlePanel : specsPanel}
      form={isPhotoLayout ? photoRightPanel : formPanel}
    />
    {layerModalPage != null ? (
      <PageLayerEditModal
        page={layerModalPage}
        totalPages={EDITOR_PAGE_SLOTS}
        layers={editorPageLayers}
        activeLayerId={activeTextLayerId}
        onActiveLayerChange={setActiveTextLayerId}
        onLayerTextChange={onLayerTextChange}
        onAddAfter={onAddLayerAfter}
        onDelete={onDeleteLayer}
        onClose={() => setLayerModalPage(null)}
      />
    ) : null}
    </>
  );
}
