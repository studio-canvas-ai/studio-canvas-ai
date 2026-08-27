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
  /** Screen pan in CSS pixels (applied with zoom on the shared stage world). */
  contentOffsetByPage?: PrintContentOffset[];
  onContentOffsetChange?: (
    pageIndex: number,
    offset: PrintContentOffset
  ) => void;
  textLayers: TextLayer[];
  /** Screen 24 style — page index is fixed at the call site, not a live ref. */
  onTextLayersChange: (pageIndex: number, layers: TextLayer[]) => void;
  photoLayers?: PrintPhotoLayer[];
  onPhotoLayersChange?: (pageIndex: number, layers: PrintPhotoLayer[]) => void;
  decoLayers?: PrintDecoLayer[];
  onDecoLayersChange?: (pageIndex: number, layers: PrintDecoLayer[]) => void;
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

type StagePanDrag = {
  pageIndex: number;
  startX: number;
  startY: number;
  origin: PrintContentOffset;
};

/**
 * Screen 26 canvas — one stage world owns bg + overlays.
 * Zoom/pan are CSS transforms on that world so children stay locked together.
 */
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
  const stagePanRef = useRef<StagePanDrag | null>(null);
  const [stagePanning, setStagePanning] = useState(false);
  const [zoomAnimating, setZoomAnimating] = useState(false);
  const pageIndex = Math.max(0, currentPage - 1);
  const aspect = resolvePrintAspect(formatId, customSize);
  const pageBg = pageActivated
    ? pageBackgroundUrl(backgroundUrls, backgroundUrl, pageIndex)
    : null;
  const pan = pageActivated
    ? normalizeContentOffset(contentOffsetByPage?.[pageIndex])
    : DEFAULT_CONTENT_OFFSET;
  const blueprint = useMemo(() => {
    if (!pageActivated || !shouldShowPrintBlueprint(formatId, useId)) {
      return null;
    }
    const raw = resolvePrintBlueprint(
      formatId,
      useId,
      pageCount as PrintPageCount,
      pageIndex,
      customSize
    );
    if (!raw) return null;
    // Match Screen 8/24 idle canvas: no permanent fold dashed lines.
    // Cut/safe frames remain; snap alignment lines come from overlays on drag.
    return { ...raw, foldLines: [] };
  }, [
    pageActivated,
    formatId,
    useId,
    pageCount,
    pageIndex,
    customSize,
  ]);

  /** Logical page size at 100% — zoom is transform:scale on the parent world. */
  const stageStyle = useMemo(
    () =>
      ({
        aspectRatio: `${aspect}`,
        width: `min(100cqw, calc(100cqh * ${aspect}))`,
        height: `min(100cqh, calc(100cqw / ${aspect}))`,
        maxWidth: "100%",
        maxHeight: "100%",
      }) as const,
    [aspect]
  );

  const worldTransform = useMemo(
    () => `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    [pan.x, pan.y, zoom]
  );

  const zoomLabel = `${Math.round(zoom * 100)}%`;
  const pageLabel =
    pageActivated && currentPage > 0
      ? fillCanvas(cs.pageOf, { page: currentPage, total: pageCount })
      : null;

  const changeZoom = (next: PrintUnifiedZoom) => {
    setZoomAnimating(true);
    onZoomChange(next);
    window.setTimeout(() => setZoomAnimating(false), 200);
  };

  const startStagePan = (e: React.PointerEvent<HTMLElement>) => {
    if (!onContentOffsetChange || !pageActivated) return;
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const target = e.target as HTMLElement;
    if (
      target.closest("[data-text-layer]") ||
      target.closest("[data-photo-layer]") ||
      target.closest("[data-deco-layer]")
    ) {
      return;
    }
    e.stopPropagation();
    if (e.pointerType === "touch") e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    stagePanRef.current = {
      pageIndex,
      startX: e.clientX,
      startY: e.clientY,
      origin: pan,
    };
    setStagePanning(true);
  };

  useEffect(() => {
    if (!stagePanning) return;
    const onMove = (e: PointerEvent) => {
      const drag = stagePanRef.current;
      if (!drag || !onContentOffsetChange) return;
      // translate() is applied after scale in visual space → 1:1 screen pixels.
      onContentOffsetChange(drag.pageIndex, {
        x: drag.origin.x + (e.clientX - drag.startX),
        y: drag.origin.y + (e.clientY - drag.startY),
      });
    };
    const onUp = () => {
      stagePanRef.current = null;
      setStagePanning(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [stagePanning, onContentOffsetChange]);

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
                pageIndex,
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
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-800 bg-[#0E1420]">
          {pageActivated ? (
            <div
              className={`absolute inset-0 flex items-center justify-center overflow-hidden p-1.5 sm:p-2 [container-type:size] ${
                stagePanning ? "cursor-grabbing" : "cursor-grab"
              }`}
              onPointerDown={startStagePan}
            >
              {/* Shared world: pan + zoom transform — all stage children move/scale together */}
              <div
                data-stage-world
                className="relative shrink-0 will-change-transform"
                style={{
                  transform: worldTransform,
                  transformOrigin: "center center",
                  transition:
                    zoomAnimating && !stagePanning
                      ? "transform 180ms ease"
                      : undefined,
                }}
              >
                <div
                  data-page-stage
                  data-page-card
                  className="relative overflow-hidden rounded-md border border-slate-700/70 bg-[#0B0F19] shadow-[0_12px_36px_rgba(0,0,0,0.4)]"
                  style={stageStyle}
                >
                  {/* Background plate */}
                  <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-md">
                    {pageBg ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={pageBg}
                        alt=""
                        draggable={false}
                        className="absolute inset-0 h-full w-full object-cover"
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

                  {/* Overlays share the same unscaled stage box (viewScale corrects pointer math). */}
                  {photoLayers?.length && onPhotoLayersChange ? (
                    <PreviewPhotoOverlay
                      layers={photoLayers}
                      onLayersChange={(layers) =>
                        onPhotoLayersChange(pageIndex, layers)
                      }
                      activeLayerId={activePhotoLayerId ?? null}
                      onActiveLayerChange={onActivePhotoLayerChange}
                      viewScale={zoom}
                    />
                  ) : null}

                  {decoLayers?.length && onDecoLayersChange ? (
                    <PreviewDecoOverlay
                      layers={decoLayers}
                      onLayersChange={(layers) =>
                        onDecoLayersChange(pageIndex, layers)
                      }
                      activeLayerId={activeDecoLayerId ?? null}
                      onActiveLayerChange={onActiveDecoLayerChange}
                      viewScale={zoom}
                    />
                  ) : null}

                  <PreviewTextOverlay
                    layers={textLayers}
                    onLayersChange={(layers) =>
                      onTextLayersChange(pageIndex, layers)
                    }
                    interactive
                    activeLayerId={activeTextLayerId ?? null}
                    onActiveLayerChange={onActiveTextLayerChange}
                    pageIndex={pageIndex}
                    backgroundSrc={pageBg}
                    editOnSingleClick
                    viewScale={zoom}
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
                1~8페이지 미니 보기를 탭하면 해당 페이지 캔버스가 활성화됩니다
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
              onClick={() => changeZoom(nextUnifiedZoom(zoom, -1))}
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
                changeZoom(
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
              onClick={() => changeZoom(nextUnifiedZoom(zoom, 1))}
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
