"use client";

import { useMemo, useRef } from "react";
import { Minus, Plus } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { fillCanvas } from "@/lib/i18n";
import PrintBlueprintOverlay from "@/components/print-wizard/PrintBlueprintOverlay";
import PreviewDecoOverlay from "@/components/print-wizard/PreviewDecoOverlay";
import PreviewPhotoOverlay from "@/components/print-wizard/PreviewPhotoOverlay";
import PreviewTextOverlay from "@/components/print-wizard/PreviewTextOverlay";
import {
  nextUnifiedZoom,
  type PrintUnifiedZoom,
} from "@/lib/printUnifiedEditor";
import { pageBackgroundUrl, bgPanObjectPosition } from "@/lib/printWizardBg";
import {
  resolvePrintBlueprint,
  shouldShowPrintBlueprint,
} from "@/lib/printWizardBlueprint";
import type {
  PrintBackgroundPan,
  PrintCustomSize,
  PrintDecoLayer,
  PrintFormatId,
  PrintPageCount,
  PrintPhotoLayer,
  PrintUseId,
} from "@/lib/printWizardTypes";
import { resolvePrintAspect } from "@/lib/printWizardTypes";
import type { TextLayer } from "@/lib/thumbnailStyles";

export type PrintUnifiedEditorCanvasProps = {
  formatId: PrintFormatId;
  useId: PrintUseId;
  pageCount: number;
  customSize: PrintCustomSize | null;
  currentPage: number;
  backgroundUrl: string | null;
  backgroundUrls: (string | null)[];
  backgroundPansByPage?: PrintBackgroundPan[];
  onBackgroundPanChange?: (pageIndex: number, pan: PrintBackgroundPan) => void;
  textLayers: TextLayer[];
  onTextLayersChange: (layers: TextLayer[]) => void;
  photoLayers?: PrintPhotoLayer[];
  onPhotoLayersChange?: (layers: PrintPhotoLayer[]) => void;
  decoLayers?: PrintDecoLayer[];
  onDecoLayersChange?: (layers: PrintDecoLayer[]) => void;
  activeTextLayerId?: string | null;
  onActiveTextLayerChange?: (id: string | null) => void;
  activePhotoLayerId?: string | null;
  onActivePhotoLayerChange?: (id: string | null) => void;
  activeDecoLayerId?: string | null;
  onActiveDecoLayerChange?: (id: string | null) => void;
  foldGuidesHidden?: boolean;
  onHideFoldGuides?: () => void;
  zoom: PrintUnifiedZoom;
  onZoomChange: (zoom: PrintUnifiedZoom) => void;
};

export default function PrintUnifiedEditorCanvas({
  formatId,
  useId,
  pageCount,
  customSize,
  currentPage,
  backgroundUrl,
  backgroundUrls,
  backgroundPansByPage,
  onBackgroundPanChange,
  textLayers,
  onTextLayersChange,
  photoLayers,
  onPhotoLayersChange,
  decoLayers,
  onDecoLayersChange,
  activeTextLayerId,
  onActiveTextLayerChange,
  activePhotoLayerId,
  onActivePhotoLayerChange,
  activeDecoLayerId,
  onActiveDecoLayerChange,
  foldGuidesHidden,
  onHideFoldGuides,
  zoom,
  onZoomChange,
}: PrintUnifiedEditorCanvasProps) {
  const { t } = useI18n();
  const cs = t.canvasStudio;
  const viewportRef = useRef<HTMLDivElement>(null);
  const pageIndex = Math.max(0, currentPage - 1);
  const aspect = resolvePrintAspect(formatId, customSize);
  const pageBg = pageBackgroundUrl(backgroundUrls, backgroundUrl, pageIndex);
  const pan = backgroundPansByPage?.[pageIndex];
  const blueprint = shouldShowPrintBlueprint(formatId, useId)
    ? resolvePrintBlueprint(
        formatId,
        useId,
        pageCount as PrintPageCount,
        pageIndex,
        customSize
      )
    : null;

  const pageCardStyle = useMemo(
    () => ({
      aspectRatio: `${aspect}`,
      width: `min(100%, calc(72vh * ${aspect}))`,
      maxWidth: "100%",
      maxHeight: "72vh",
    }),
    [aspect]
  );

  const zoomLabel = `${Math.round(zoom * 100)}%`;

  return (
    <section className="flex h-full min-h-0 flex-col gap-1">
      <header className="flex shrink-0 items-center gap-2 px-0.5">
        <h2 className="min-w-0 flex-1 truncate text-[12px] font-semibold tracking-tight text-slate-200 sm:text-[13px]">
          {cs.printTitle}
        </h2>
        <span className="shrink-0 rounded-md bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-200">
          {fillCanvas(cs.pageOf, { page: currentPage, total: pageCount })}
        </span>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-800 bg-[#121824] p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.35)] sm:p-2">
        <div
          ref={viewportRef}
          className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto overscroll-contain rounded-xl border border-slate-800 bg-[#0E1420] p-3 sm:p-4"
        >
          <div
            className="relative shrink-0 transition-transform duration-200 ease-out"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "center center",
            }}
          >
            <div
              data-page-card
              className="relative overflow-visible rounded-md border border-slate-700/70 bg-[#0B0F19] shadow-[0_12px_36px_rgba(0,0,0,0.4)]"
              style={pageCardStyle}
            >
              <div
                data-page-stage
                className="absolute inset-0 overflow-visible"
              >
                <div className="absolute inset-0 overflow-hidden rounded-md">
                  {pageBg ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={pageBg}
                        alt=""
                        draggable={false}
                        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                        style={{
                          objectPosition: pan
                            ? bgPanObjectPosition(pan)
                            : "50% 50%",
                          animation: "pw-fade-in 0.45s ease forwards",
                        }}
                      />
                    </>
                  ) : (
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(99,102,241,0.22),transparent_55%),radial-gradient(ellipse_at_80%_80%,rgba(16,185,129,0.12),transparent_50%),linear-gradient(160deg,#121824,#0B0F19)]" />
                  )}

                  {blueprint ? (
                    <PrintBlueprintOverlay
                      blueprint={blueprint}
                      foldGuidesHidden={foldGuidesHidden}
                      onHideFoldGuides={onHideFoldGuides}
                      removeFoldLabel={cs.removeFoldGuides}
                    />
                  ) : null}
                </div>

                {photoLayers?.length && onPhotoLayersChange ? (
                  <PreviewPhotoOverlay
                    layers={photoLayers}
                    onLayersChange={onPhotoLayersChange}
                    activeLayerId={activePhotoLayerId ?? null}
                    onActiveLayerChange={onActivePhotoLayerChange}
                  />
                ) : null}

                {decoLayers?.length && onDecoLayersChange ? (
                  <PreviewDecoOverlay
                    layers={decoLayers}
                    onLayersChange={onDecoLayersChange}
                    activeLayerId={activeDecoLayerId ?? null}
                    onActiveLayerChange={onActiveDecoLayerChange}
                  />
                ) : null}

                <PreviewTextOverlay
                  layers={textLayers}
                  onLayersChange={onTextLayersChange}
                  interactive
                  activeLayerId={activeTextLayerId ?? null}
                  onActiveLayerChange={onActiveTextLayerChange}
                  pageIndex={pageIndex}
                  backgroundSrc={pageBg}
                  showEmptyGuideBoxes
                  editOnSingleClick
                />
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-3 right-3 z-20 flex items-center gap-1 rounded-lg border border-white/10 bg-black/70 p-0.5 shadow-lg backdrop-blur-sm">
          <button
            type="button"
            aria-label="캔버스 축소"
            title="축소"
            onClick={() => onZoomChange(nextUnifiedZoom(zoom, -1))}
            className="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-white/85 transition hover:bg-white/10 hover:text-white disabled:opacity-35"
            disabled={zoom <= 0.5}
          >
            <Minus className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={`캔버스 배율 ${zoomLabel}`}
            title="배율 선택"
            onClick={() => {
              const order = [0.5, 0.75, 1] as const;
              const idx = order.indexOf(zoom);
              onZoomChange(order[(idx + 1) % order.length] ?? 0.75);
            }}
            className="pointer-events-auto inline-flex min-w-[3.25rem] items-center justify-center rounded-md px-1.5 py-1 text-[11px] font-bold tabular-nums text-emerald-300 transition hover:bg-white/10"
          >
            {zoomLabel}
          </button>
          <button
            type="button"
            aria-label="캔버스 확대"
            title="확대"
            onClick={() => onZoomChange(nextUnifiedZoom(zoom, 1))}
            className="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-white/85 transition hover:bg-white/10 hover:text-white disabled:opacity-35"
            disabled={zoom >= 1}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </section>
  );
}
