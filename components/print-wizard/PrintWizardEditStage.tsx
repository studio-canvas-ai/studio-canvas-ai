"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import StudioExportButtonGroup from "@/components/canvas/StudioExportButtonGroup";
import PreviewCanvas from "@/components/print-wizard/PreviewCanvas";
import PrintWizardStep2Layout from "@/components/print-wizard/PrintWizardStep2Layout";
import { usePrintWizardExport } from "@/lib/canvas/usePrintWizardExport";
import { resolvePrintAspect } from "@/lib/printWizardTypes";
import { toDisplayImageSrc } from "@/lib/resultSession";
import type { PrintWizardState } from "@/lib/printWizardTypes";
import type { TextLayer } from "@/lib/thumbnailStyles";

const AiTemplateStudio = dynamic(
  () => import("@/components/AiTemplateStudio"),
  { ssr: false }
);

export type PrintWizardEditStageProps = {
  state: PrintWizardState;
  currentPage: number;
  onCurrentPageChange: (page: number) => void;
  textLayersByPage: TextLayer[][];
  onTextLayersChange: (pageIndex: number, layers: TextLayer[]) => void;
  activeTextLayerId?: string | null;
  onActiveTextLayerChange?: (id: string | null) => void;
  onHideFoldGuides?: () => void;
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
  activeTextLayerId = null,
  onActiveTextLayerChange,
  onHideFoldGuides,
}: PrintWizardEditStageProps) {
  const aspect = resolvePrintAspect(state.formatId, state.customSize);
  const activeBg =
    state.backgroundUrls[Math.max(0, currentPage - 1)] ||
    state.backgroundUrl ||
    null;

  const pageIndex = Math.max(0, currentPage - 1);
  const overlayLayers = useMemo(
    () => textLayersByPage[pageIndex] ?? [],
    [textLayersByPage, pageIndex]
  );

  const backgroundUrl = useMemo(() => {
    const raw = state.backgroundUrls[0] || state.backgroundUrl || null;
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
    sharePreview,
    requireSubscription,
    premiumModal: exportPremiumModal,
  } = usePrintWizardExport({
    activeBg,
    customSize: state.customSize,
    aspect,
    titlePreview: state.inputs.title,
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
            datePreview={state.inputs.date}
            titlePreview={state.inputs.title}
            subtitlePreview={state.inputs.subtitle}
            locationPreview={state.inputs.location}
            organizerPreview={state.inputs.organizer}
            programsPreview={state.inputs.programs}
            overlayLayersByPage={textLayersByPage}
            onOverlayLayersChange={onTextLayersChange}
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
                  onTextLayersChange(pageIndex, layers)
                }
                formFields={formFields}
                initialVisualStyle={state.visualStyle}
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
