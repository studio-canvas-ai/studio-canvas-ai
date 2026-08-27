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
  PRINT_UNIFIED_ZOOM_LEVELS,
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
  /** 0 = no page selected yet (initial idle canvas). */
  currentPage: number;
  /** True only after the user clicks a page tab in the right panel. */
  pageActivated: boolean;
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
  pageActivated,
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
  const pageBg = pageActivated
    ? pageBackgroundUrl(backgroundUrls, backgroundUrl, pageIndex)
    : null;
  const pan = pageActivated ? backgroundPansByPage?.[pageIndex] : undefined;
  const blueprint =
    pageActivated && shouldShowPrintBlueprint(formatId, useId)
      ? resolvePrintBlueprint(
          formatId,
          useId,
          pageCount as PrintPageCount,
          pageIndex,
          customSize
        )
      : null;

  /** Same sizing as Screen 8 PreviewCanvas — zoom multiplies layout size (not just visual scale). */
  const pageCardStyle = useMemo(
    () =>
      ({
        aspectRatio: `${aspect}`,
        width: `min(calc(100cqw * ${zoom}), calc(100cqh * ${aspect} * ${zoom}))`,
        height: `min(calc(100cqh * ${zoom}), calc(100cqw / ${aspect} * ${zoom}))`,
        maxWidth: "100%",
        maxHeight: "100%",
        transition:
          "width 220ms ease, height 220ms ease, aspect-ratio 220ms ease",
      }) as const,
    [aspect, zoom]
  );

  const zoomLabel = `${Math.round(zoom * 100)}%`;
  const pageLabel =
    pageActivated && currentPage > 0
      ? fillCanvas(cs.pageOf, { page: currentPage, total: pageCount })
      : null;

  return (
    <section className="flex h-full min-h-0 flex-col gap-1">
      <header className="flex shrink-0 items-center gap-2 px-0.5 leading-none">
        <h2 className="min-w-0 flex-1 truncate text-[12px] font-semibold tracking-tight text-slate-200 sm:text-[13px]">
          {cs.printTitle}
        </h2>
        {pageLabel ? (
          <span className="shrink-0 rounded-md bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-200">
            {pageLabel}
          </span>
        ) : null}
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-800 bg-[#121824] p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.35)] sm:gap-2 sm:p-2">
        <div
          ref={viewportRef}
          className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-800 bg-[#0E1420]"
        >
          {pageActivated ? (
            <div className="flex h-full min-h-0 w-full items-center justify-center overflow-auto overscroll-contain p-1.5 sm:p-2 [container-type:size]">
              <div
                data-page-card
                className="relative shrink-0 overflow-visible rounded-md border border-slate-700/70 bg-[#0B0F19] shadow-[0_12px_36px_rgba(0,0,0,0.4)]"
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
                      hideGuideLabels
                      editOnSingleClick
                    />
                  </div>
                </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[280px] w-full flex-col items-center justify-center gap-2 px-6 text-center">
              <p className="text-sm font-medium text-white/55">
                중앙 패널 하단에서 편집할 페이지를 선택해 주세요
              </p>
              <p className="max-w-xs text-[11px] leading-relaxed text-white/35">
                1~8페이지 미니 보기를 탭하면 배경과 점선 가이드 박스가
                표시됩니다
              </p>
            </div>
          )}
        </div>

        {pageActivated ? (
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
              const idx = PRINT_UNIFIED_ZOOM_LEVELS.indexOf(zoom);
              onZoomChange(
                PRINT_UNIFIED_ZOOM_LEVELS[
                  (idx + 1) % PRINT_UNIFIED_ZOOM_LEVELS.length
                ] ?? 1
              );
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
            disabled={zoom >= 1.5}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
        ) : null}
      </div>
    </section>
  );
}
