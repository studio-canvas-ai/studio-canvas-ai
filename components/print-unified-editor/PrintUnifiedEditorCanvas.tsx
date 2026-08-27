"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { fillCanvas } from "@/lib/i18n";
import CanvasUploadToolbar from "@/components/canvas/CanvasUploadToolbar";
import PrintBlueprintOverlay from "@/components/print-wizard/PrintBlueprintOverlay";
import PreviewDecoOverlay from "@/components/print-wizard/PreviewDecoOverlay";
import PreviewPhotoOverlay from "@/components/print-wizard/PreviewPhotoOverlay";
import PreviewTextOverlay from "@/components/print-wizard/PreviewTextOverlay";
import {
  DEFAULT_CONTENT_OFFSET,
  nextUnifiedZoom,
  normalizeContentOffset,
  PRINT_UNIFIED_ZOOM_LEVELS,
  type PrintContentOffset,
  type PrintUnifiedZoom,
} from "@/lib/printUnifiedEditor";
import { pageBackgroundUrl } from "@/lib/printWizardBg";
import {
  resolvePrintBlueprint,
  shouldShowPrintBlueprint,
} from "@/lib/printWizardBlueprint";
import type {
  PrintCustomSize,
  PrintDecoLayer,
  PrintFormatId,
  PrintPageCount,
  PrintPhotoLayer,
  PrintUseId,
} from "@/lib/printWizardTypes";
import { resolvePrintAspect } from "@/lib/printWizardTypes";
import type { TextLayer } from "@/lib/thumbnailStyles";
import type { PhotoKind } from "@/lib/canvas/addPhotoLayer";
import type { RecentProjectNamespace } from "@/lib/canvas/recentProjects";
import type { StudioCanvasProjectV1 } from "@/lib/canvas/projectFile";

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
  contentOffsetByPage?: PrintContentOffset[];
  onContentOffsetChange?: (
    pageIndex: number,
    offset: PrintContentOffset
  ) => void;
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
  exportBusy?: boolean;
  generating?: boolean;
  requireSubscription?: () => boolean;
  onInstallPhoto?: (file: File, mode: PhotoKind) => Promise<void>;
  onOpenRecentProject?: (project: StudioCanvasProjectV1) => void;
  onResetWorkspace?: () => void;
  recentNamespace?: RecentProjectNamespace;
};

type ContentPanDrag = {
  pageIndex: number;
  startX: number;
  startY: number;
  origin: PrintContentOffset;
  frameW: number;
  frameH: number;
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
  contentOffsetByPage,
  onContentOffsetChange,
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
  exportBusy = false,
  generating = false,
  requireSubscription,
  onInstallPhoto,
  onOpenRecentProject,
  onResetWorkspace,
  recentNamespace = "screen_008",
}: PrintUnifiedEditorCanvasProps) {
  const { t } = useI18n();
  const cs = t.canvasStudio;
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentPanRef = useRef<ContentPanDrag | null>(null);
  const [contentPanning, setContentPanning] = useState(false);
  const pageIndex = Math.max(0, currentPage - 1);
  const aspect = resolvePrintAspect(formatId, customSize);
  const pageBg = pageActivated
    ? pageBackgroundUrl(backgroundUrls, backgroundUrl, pageIndex)
    : null;
  const contentOffset = pageActivated
    ? normalizeContentOffset(contentOffsetByPage?.[pageIndex])
    : DEFAULT_CONTENT_OFFSET;
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

  const startContentPan = (e: React.PointerEvent<HTMLElement>) => {
    if (!onContentOffsetChange || !pageActivated) return;
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const t = e.target as HTMLElement;
    if (
      t.closest("[data-text-layer]") ||
      t.closest("[data-photo-layer]") ||
      t.closest("[data-deco-layer]") ||
      t.closest("[data-blueprint-chrome]")
    ) {
      return;
    }
    const stage =
      (e.currentTarget.closest("[data-page-stage]") as HTMLElement | null) ??
      e.currentTarget;
    const rect = stage.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return;
    e.stopPropagation();
    if (e.pointerType === "touch") e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    contentPanRef.current = {
      pageIndex,
      startX: e.clientX,
      startY: e.clientY,
      origin: contentOffset,
      frameW: rect.width,
      frameH: rect.height,
    };
    setContentPanning(true);
  };

  useEffect(() => {
    if (!contentPanning) return;
    const onMove = (e: PointerEvent) => {
      const drag = contentPanRef.current;
      if (!drag || !onContentOffsetChange) return;
      const dx = (e.clientX - drag.startX) / Math.max(1, drag.frameW);
      const dy = (e.clientY - drag.startY) / Math.max(1, drag.frameH);
      // 1:1 pan, unclamped — content may leave the page frame.
      onContentOffsetChange(drag.pageIndex, {
        x: drag.origin.x + dx,
        y: drag.origin.y + dy,
      });
    };
    const onUp = () => {
      contentPanRef.current = null;
      setContentPanning(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [contentPanning, onContentOffsetChange]);

  return (
    <section className="flex h-full min-h-0 flex-col gap-1">
      <header className="flex shrink-0 items-center gap-2 px-0.5 leading-none">
        <h2 className="shrink-0 text-[12px] font-semibold tracking-tight text-slate-200 [word-break:keep-all] sm:text-[13px]">
          {cs.printTitle}
        </h2>
        {pageLabel ? (
          <span className="shrink-0 rounded-md bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-200">
            {pageLabel}
          </span>
        ) : null}
        <div className="min-w-0 flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <CanvasUploadToolbar
            dense
            nowrap
            className="justify-start"
            actions="full"
            disabled={exportBusy || generating}
            requireSubscription={requireSubscription}
            extraDeletable={
              activePhotoLayerId
                ? { id: activePhotoLayerId, type: "photo" }
                : null
            }
            onInstallFile={onInstallPhoto}
            onDeleteObject={(id, type) => {
              if (type !== "photo" || !onPhotoLayersChange || !photoLayers)
                return;
              onPhotoLayersChange(
                photoLayers.filter((layer) => layer.id !== id)
              );
              if (activePhotoLayerId === id) onActivePhotoLayerChange?.(null);
            }}
            onLoadRecentProject={onOpenRecentProject}
            recentNamespace={recentNamespace}
          />
        </div>
        {onResetWorkspace ? (
          <button
            type="button"
            onClick={onResetWorkspace}
            disabled={exportBusy || generating}
            title={cs.reset}
            aria-label={cs.reset}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-red-400/40 bg-red-500/10 px-2 text-[10px] font-semibold leading-none text-red-200 transition hover:bg-red-500/20 disabled:opacity-40"
          >
            <Trash2 className="h-3 w-3 shrink-0" aria-hidden />
            <span className="whitespace-nowrap">{cs.reset}</span>
          </button>
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
                className="relative shrink-0 overflow-hidden rounded-md border border-slate-700/70 bg-[#0B0F19] shadow-[0_12px_36px_rgba(0,0,0,0.4)]"
                style={pageCardStyle}
              >
                <div
                  data-page-stage
                  className={`absolute inset-0 overflow-hidden ${
                    contentPanning ? "cursor-grabbing" : "cursor-grab"
                  }`}
                  onPointerDown={startContentPan}
                >
                  {/* Background + overlays pan as one group (unclamped). */}
                  <div
                    data-content-group
                    className="absolute inset-0 will-change-transform"
                    style={{
                      transform: `translate(${contentOffset.x * 100}%, ${contentOffset.y * 100}%)`,
                    }}
                  >
                    <div className="absolute inset-0 overflow-visible">
                      {pageBg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={pageBg}
                          alt=""
                          draggable={false}
                          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                          style={{
                            animation: "pw-fade-in 0.45s ease forwards",
                          }}
                        />
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
