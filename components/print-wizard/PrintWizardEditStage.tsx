"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import StudioExportButtonGroup from "@/components/canvas/StudioExportButtonGroup";
import PreviewCanvas from "@/components/print-wizard/PreviewCanvas";
import PrintWizardStep2Layout from "@/components/print-wizard/PrintWizardStep2Layout";
import { usePrintWizardExport } from "@/lib/canvas/usePrintWizardExport";
import {
  resolvePrintAspect,
  type PrintBackgroundPan,
  type PrintDecoLayer,
  type PrintPhotoLayer,
  type PrintWizardState,
} from "@/lib/printWizardTypes";
import {
  reconcileLayerTypographyBox,
  referencePrintStageSize,
  resolvePageTextLayersForExport,
} from "@/lib/printWizardTextLayers";
import { toDisplayImageSrc } from "@/lib/resultSession";
import { pageBackgroundUrl } from "@/lib/printWizardBg";
import type { TextLayer } from "@/lib/thumbnailStyles";
import type { PhotoKind } from "@/lib/canvas/addPhotoLayer";
import type { RecentProjectNamespace } from "@/lib/canvas/recentProjects";
import {
  capturePhotoLookbookSnapshot,
  compositePhotoLookbookBlob,
  photoLookbookHasExportableFrame,
} from "@/lib/photoLookbookProject";
import {
  compositePrintWizardPageBlob,
  printWizardHasExportableFrame,
} from "@/lib/printWizardComposite";

const AiTemplateStudio = dynamic(
  () => import("@/components/AiTemplateStudio"),
  { ssr: false }
);

export type PrintWizardEditStageProps = {
  state: PrintWizardState;
  currentPage: number;
  onCurrentPageChange: (page: number) => void;
  textLayersByPage: TextLayer[][];
  onTextLayersChange: (
    pageIndex: number,
    layers: TextLayer[],
    options?: { applyLayout?: boolean }
  ) => void;
  photoLayersByPage?: PrintPhotoLayer[][];
  onPhotoLayersChange?: (pageIndex: number, layers: PrintPhotoLayer[]) => void;
  decoLayersByPage?: PrintDecoLayer[][];
  onDecoLayersChange?: (pageIndex: number, layers: PrintDecoLayer[]) => void;
  onDecoCatalogPick?: (decoId: string) => void;
  onCanvasSymbolPick?: (symbol: string) => void;
  onBackgroundPanChange?: (pageIndex: number, pan: PrintBackgroundPan) => void;
  activePhotoLayerId?: string | null;
  onActivePhotoLayerChange?: (id: string | null) => void;
  activeDecoLayerId?: string | null;
  onActiveDecoLayerChange?: (id: string | null) => void;
  onInstallPhoto?: (file: File, mode: PhotoKind) => Promise<void>;
  activeTextLayerId?: string | null;
  onActiveTextLayerChange?: (id: string | null) => void;
  onHideFoldGuides?: () => void;
  onResetWorkspace?: () => void;
  onClearCanvasImages?: () => void;
  studioPath?: string;
  pendingProjectKey?: string;
  panelTitle?: string;
  recentNamespace?: RecentProjectNamespace;
  /** When true, .sca embeds lookbook vault + wizard snapshot. */
  isPhotoLookbook?: boolean;
  /** Apply recent project on this wizard (no sub-studio redirect). */
  onOpenRecentProject?: (project: import("@/lib/canvas/projectFile").StudioCanvasProjectV1) => void;
};

/**
 * Step 2 — Print wizard preview (left) + Template Studio edit panel (right).
 */
export default function PrintWizardEditStage({
  state,
  currentPage,
  onCurrentPageChange,
  textLayersByPage,
  onTextLayersChange,
  photoLayersByPage,
  onPhotoLayersChange,
  decoLayersByPage,
  onDecoLayersChange,
  onDecoCatalogPick,
  onCanvasSymbolPick,
  onBackgroundPanChange,
  activePhotoLayerId = null,
  onActivePhotoLayerChange,
  activeDecoLayerId = null,
  onActiveDecoLayerChange,
  onInstallPhoto,
  activeTextLayerId = null,
  onActiveTextLayerChange,
  onHideFoldGuides,
  onResetWorkspace,
  onClearCanvasImages,
  studioPath,
  pendingProjectKey,
  panelTitle,
  recentNamespace,
  isPhotoLookbook = false,
  onOpenRecentProject,
}: PrintWizardEditStageProps) {
  const aspect = resolvePrintAspect(state.formatId, state.customSize);
  const typographyStage = useMemo(
    () => referencePrintStageSize(aspect),
    [aspect]
  );
  const activeBg = pageBackgroundUrl(
    state.backgroundUrls,
    state.backgroundUrl,
    Math.max(0, currentPage - 1)
  );

  const pageIndex = Math.max(0, currentPage - 1);
  const overlayLayers = useMemo(
    () => textLayersByPage[pageIndex] ?? [],
    [textLayersByPage, pageIndex]
  );

  const backgroundUrl = useMemo(() => {
    const raw = pageBackgroundUrl(
      state.backgroundUrls,
      state.backgroundUrl,
      0
    );
    return raw ? toDisplayImageSrc(raw) : null;
  }, [state.backgroundUrl, state.backgroundUrls]);

  const formFields = useMemo(() => ({ ...state.inputs }), [state.inputs]);
  const [textLayersHost, setTextLayersHost] = useState<HTMLDivElement | null>(
    null
  );

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
    studioPath,
    pendingProjectKey,
    recentNamespace,
    overlayLayers: resolvePageTextLayersForExport(
      textLayersByPage,
      pageIndex,
      state.inputs,
      state.pageCount
    ),
    onApplyRecentProject: onOpenRecentProject,
    resolveExportImage: async (quality) => {
      const exportState: PrintWizardState = {
        ...state,
        textLayersByPage,
        photoLayersByPage: photoLayersByPage ?? state.photoLayersByPage,
        decoLayersByPage: decoLayersByPage ?? state.decoLayersByPage,
      };
      if (isPhotoLookbook) {
        if (!photoLookbookHasExportableFrame(exportState)) {
          throw new Error("nothing_to_export");
        }
        return compositePhotoLookbookBlob({
          state: exportState,
          pageIndex,
          quality,
        });
      }
      if (!printWizardHasExportableFrame(exportState)) {
        throw new Error("nothing_to_export");
      }
      return compositePrintWizardPageBlob({
        state: exportState,
        pageIndex,
        quality,
      });
    },
    buildLookbookSnapshot: () =>
      capturePhotoLookbookSnapshot({
        ...state,
        textLayersByPage,
        photoLayersByPage: photoLayersByPage ?? state.photoLayersByPage,
        decoLayersByPage: decoLayersByPage ?? state.decoLayersByPage,
      }),
  });

  return (
    <>
      <PrintWizardStep2Layout
        middle={
          <div
            ref={setTextLayersHost}
            className="flex w-full min-h-0 flex-col"
          />
        }
        preview={
          <PreviewCanvas
            formatId={state.formatId}
            useId={state.useId}
            pageCount={state.pageCount}
            customSize={state.customSize}
            backgroundUrl={state.backgroundUrl}
            backgroundUrls={state.backgroundUrls}
            backgroundPansByPage={state.backgroundPansByPage}
            onBackgroundPanChange={onBackgroundPanChange}
            datePreview={state.inputs.date}
            titlePreview={state.inputs.title}
            subtitlePreview={state.inputs.subtitle}
            locationPreview={state.inputs.location}
            organizerPreview={state.inputs.organizer}
            programsPreview={state.inputs.programs}
            overlayLayersByPage={textLayersByPage}
            onOverlayLayersChange={onTextLayersChange}
            photoLayersByPage={photoLayersByPage}
            onPhotoLayersChange={onPhotoLayersChange}
            activePhotoLayerId={activePhotoLayerId}
            onActivePhotoLayerChange={onActivePhotoLayerChange}
            decoLayersByPage={decoLayersByPage}
            onDecoLayersChange={onDecoLayersChange}
            activeDecoLayerId={activeDecoLayerId}
            onActiveDecoLayerChange={onActiveDecoLayerChange}
            onInstallPhoto={onInstallPhoto}
            activeTextLayerId={activeTextLayerId}
            onActiveTextLayerChange={onActiveTextLayerChange}
            currentPage={currentPage}
            onCurrentPageChange={onCurrentPageChange}
            showHeaderBack={false}
            toolbarMode="delete-only"
            exportBusy={exportBusy}
            requireSubscription={requireSubscription}
            foldGuidesHidden={state.foldGuidesHidden}
            onHideFoldGuides={onHideFoldGuides}
            onResetWorkspace={onResetWorkspace}
            onClearCanvasImages={onClearCanvasImages}
            studioPath={studioPath}
            pendingProjectKey={pendingProjectKey}
            panelTitle={panelTitle}
          />
        }
        editPanel={
          <div className="flex h-full min-h-0 w-full flex-col gap-2">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
              <AiTemplateStudio
                mode="agent"
                embedded
                panelOnly
                hideExport
                hideAiCommand
                textLayersHost={textLayersHost}
                initialBackgroundUrl={backgroundUrl}
                controlledOverlayLayers={overlayLayers}
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
                onControlledActiveLayerChange={onActiveTextLayerChange}
                formFields={formFields}
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
