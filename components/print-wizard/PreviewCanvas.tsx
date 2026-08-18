"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, X } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { fillCanvas } from "@/lib/i18n";
import CanvasUploadToolbar from "@/components/canvas/CanvasUploadToolbar";
import { useFeedback } from "@/components/FeedbackProvider";
import { useCanvasStore } from "@/lib/canvas/canvasStore";
import { stashPendingStudioProject } from "@/lib/canvas/projectFile";
import { PRINT_STUDIO_PATH } from "@/lib/printWizardSession";
import PreviewTextOverlay from "@/components/print-wizard/PreviewTextOverlay";
import PrintBlueprintOverlay from "@/components/print-wizard/PrintBlueprintOverlay";
import {
  resolvePrintBlueprint,
  shouldShowPrintBlueprint,
} from "@/lib/printWizardBlueprint";
import type { TextLayer } from "@/lib/thumbnailStyles";
import {
  resolvePrintAspect,
  type PrintCustomSize,
  type PrintFormatId,
  type PrintPageCount,
  type PrintUseId,
} from "@/lib/printWizardTypes";

export type PreviewCanvasProps = {
  formatId: PrintFormatId;
  useId: PrintUseId;
  pageCount: PrintPageCount;
  customSize?: PrintCustomSize | null;
  backgroundUrl: string | null;
  backgroundUrls?: string[];
  generating?: boolean;
  titlePreview?: string;
  subtitlePreview?: string;
  datePreview?: string;
  locationPreview?: string;
  organizerPreview?: string;
  programsPreview?: string;
  /** Per-page interactive text boxes (index 0 = 1면). */
  overlayLayersByPage?: TextLayer[][];
  onOverlayLayersChange?: (pageIndex: number, layers: TextLayer[]) => void;
  activeTextLayerId?: string | null;
  onActiveTextLayerChange?: (id: string | null) => void;
  textOverlayInteractive?: boolean;
  currentPage: number;
  onCurrentPageChange: (page: number) => void;
  /** When false, back arrow is omitted (e.g. Step 2 uses Navbar back). */
  showHeaderBack?: boolean;
  /** Step 2 keeps only the delete control on the canvas toolbar. */
  toolbarMode?: "full" | "delete-only";
  exportBusy?: boolean;
  requireSubscription?: () => boolean;
  onOpenRecentProject?: (project: import("@/lib/canvas/projectFile").StudioCanvasProjectV1) => void;
  foldGuidesHidden?: boolean;
  onHideFoldGuides?: () => void;
};

type LightboxState = {
  src: string;
  pageNum: number;
  /** Image area size after fit-to-screen */
  imgW: number;
  imgH: number;
  /** Source preview-card stage size (for resize refit) */
  stageW: number;
  stageH: number;
};

const HEADER_H = 40;
const BODY_PAD = 16; // p-2 × 2
const EDGE_GAP = 12;
const NAV_H = 64;
const MODAL_MAX_VH = 0.88;
const MODAL_MAX_VW = 0.72;
/** Above specs / preview columns; below the right form (z-500). */
const LIGHTBOX_Z = 450;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Viewport box for the global overlay — never taller than the remaining screen under the nav. */
function lightboxBounds() {
  const form = document.querySelector<HTMLElement>("[data-wizard-form]");
  const formLeft = form?.getBoundingClientRect().left;
  const minY = NAV_H;
  const maxWinH = Math.max(
    200,
    Math.min(
      Math.round(window.innerHeight * MODAL_MAX_VH),
      window.innerHeight - minY - EDGE_GAP
    )
  );
  const stackedForm = typeof formLeft !== "number" || formLeft < 360;
  const rightLimit = stackedForm
    ? window.innerWidth - EDGE_GAP
    : Math.max(EDGE_GAP + 240, formLeft - EDGE_GAP);
  const maxWinW = Math.max(
    240,
    Math.min(Math.round(window.innerWidth * MODAL_MAX_VW), rightLimit - EDGE_GAP)
  );
  return { minY, maxWinW, maxWinH, rightLimit };
}

function fitLightboxStage(
  stageW: number,
  stageH: number
): { imgW: number; imgH: number; winW: number; winH: number } {
  const { maxWinW, maxWinH } = lightboxBounds();
  const maxImgH = Math.max(80, maxWinH - HEADER_H - BODY_PAD);
  const maxImgW = Math.max(80, maxWinW - BODY_PAD);
  let imgW = Math.max(1, Math.round(stageW * 2));
  let imgH = Math.max(1, Math.round(stageH * 2));
  const s = Math.min(1, maxImgW / imgW, maxImgH / imgH);
  imgW = Math.max(1, Math.round(imgW * s));
  imgH = Math.max(1, Math.round(imgH * s));
  return {
    imgW,
    imgH,
    winW: imgW + BODY_PAD,
    winH: imgH + HEADER_H + BODY_PAD,
  };
}

function clampLightboxPos(x: number, y: number, winW: number, winH: number) {
  const { minY, rightLimit } = lightboxBounds();
  const maxX = Math.max(EDGE_GAP, rightLimit - winW);
  const maxY = Math.max(minY, window.innerHeight - winH - EDGE_GAP);
  return {
    x: clamp(x, EDGE_GAP, maxX),
    y: clamp(y, minY, maxY),
  };
}

export default function PreviewCanvas({
  formatId,
  useId,
  pageCount,
  customSize = null,
  backgroundUrl,
  backgroundUrls = [],
  generating = false,
  titlePreview = "",
  subtitlePreview = "",
  datePreview = "",
  locationPreview = "",
  organizerPreview = "",
  programsPreview = "",
  overlayLayersByPage,
  onOverlayLayersChange,
  activeTextLayerId = null,
  onActiveTextLayerChange,
  textOverlayInteractive = true,
  currentPage,
  onCurrentPageChange,
  showHeaderBack = true,
  toolbarMode = "full",
  exportBusy = false,
  requireSubscription,
  onOpenRecentProject,
  foldGuidesHidden = false,
  onHideFoldGuides,
}: PreviewCanvasProps) {
  const router = useRouter();
  const { t } = useI18n();
  const cs = t.canvasStudio;
  const { showToast } = useFeedback();
  const aspect = resolvePrintAspect(formatId, customSize);
  const totalPages = pageCount;
  const pageLabel =
    pageCount === 1
      ? cs.pageSingle
      : pageCount === 2
        ? cs.pageDouble
        : fillCanvas(cs.pageN, { n: pageCount });
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [floatPos, setFloatPos] = useState({ x: EDGE_GAP, y: 72 });
  const [dragging, setDragging] = useState(false);

  // Seed canvas meta so Step-2 uploads land at print aspect before studio opens.
  useEffect(() => {
    const width = 1080;
    const height = Math.max(1, Math.round(width / Math.max(aspect, 0.05)));
    useCanvasStore.getState().setMeta({
      width,
      height,
      mode: "agent",
      dpi: 300,
    });
  }, [aspect]);

  const activeBg =
    backgroundUrls[Math.max(0, currentPage - 1)] || backgroundUrl || null;

  const floatOuterW = lightbox
    ? lightbox.imgW + BODY_PAD
    : 420;
  const floatOuterH = lightbox
    ? lightbox.imgH + HEADER_H + BODY_PAD
    : 560;

  useEffect(() => {
    const next = Math.min(Math.max(1, currentPage), totalPages);
    if (next !== currentPage) onCurrentPageChange(next);
  }, [totalPages, currentPage, onCurrentPageChange]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox]);

  useEffect(() => {
    if (!lightbox) return;
    const refit = () => {
      const fitted = fitLightboxStage(lightbox.stageW, lightbox.stageH);
      setLightbox((prev) =>
        prev
          ? { ...prev, imgW: fitted.imgW, imgH: fitted.imgH }
          : prev
      );
      setFloatPos((pos) =>
        clampLightboxPos(pos.x, pos.y, fitted.winW, fitted.winH)
      );
    };
    window.addEventListener("resize", refit);
    return () => window.removeEventListener("resize", refit);
  }, [lightbox?.stageW, lightbox?.stageH, lightbox?.src]);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const nextX = d.originX + (e.clientX - d.startX);
      const nextY = d.originY + (e.clientY - d.startY);
      setFloatPos(clampLightboxPos(nextX, nextY, floatOuterW, floatOuterH));
    };

    const onUp = () => {
      dragRef.current = null;
      setDragging(false);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging, floatOuterW, floatOuterH]);

  // Sync thumbnail highlight with the page most visible in the scroll viewer.
  useEffect(() => {
    const root = previewContainerRef.current;
    if (!root) return;

    const pages = Array.from(
      root.querySelectorAll<HTMLElement>("[data-preview-page]")
    );
    if (!pages.length) return;

    const ratios = new Map<number, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const n = Number(
            (entry.target as HTMLElement).dataset.previewPage || "0"
          );
          if (n > 0) ratios.set(n, entry.intersectionRatio);
        }
        let best = 1;
        let bestRatio = -1;
        for (const [n, ratio] of ratios) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            best = n;
          }
        }
        if (bestRatio >= 0) onCurrentPageChange(best);
      },
      { root, threshold: [0.35, 0.55, 0.75, 1] }
    );

    for (const el of pages) observer.observe(el);
    return () => observer.disconnect();
  }, [totalPages, aspect, onCurrentPageChange]);

  const handleThumbnailClick = (pageNumber: number) => {
    onCurrentPageChange(pageNumber);
    const root = previewContainerRef.current;
    if (!root) return;
    const target = root.querySelector(`#preview-page-${pageNumber}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  const pageCardEl = (pageNumber: number): HTMLElement | null => {
    return (
      previewContainerRef.current?.querySelector(
        `#preview-page-${pageNumber} [data-page-card]`
      ) ?? null
    );
  };

  const openLightboxForPage = (pageNumber: number) => {
    const src =
      backgroundUrls[Math.max(0, pageNumber - 1)] || backgroundUrl || null;
    if (!src) return;
    const card = pageCardEl(pageNumber);
    if (!card) return;
    openLightbox(src, pageNumber, card);
  };

  const handleChromePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    const t = e.target as HTMLElement;
    if (t.closest("[data-page-card]")) return;
    if (t.closest("[data-mini-thumb]")) return;
    if (t.closest("[data-text-layer]")) return;
    onActiveTextLayerChange?.(null);
  };

  const openLightbox = (
    src: string,
    pageNum: number,
    cardEl: HTMLElement
  ) => {
    const stage =
      (cardEl.querySelector("[data-page-stage]") as HTMLElement | null) ??
      cardEl;
    const stageW = Math.max(1, stage.clientWidth);
    const stageH = Math.max(1, stage.clientHeight);
    const fitted = fitLightboxStage(stageW, stageH);
    const { minY, rightLimit } = lightboxBounds();
    const x = Math.round((EDGE_GAP + rightLimit - fitted.winW) / 2);
    const y = Math.round(minY + (window.innerHeight - minY - fitted.winH) / 2);

    setFloatPos(clampLightboxPos(x, y, fitted.winW, fitted.winH));
    setLightbox({
      src,
      pageNum,
      imgW: fitted.imgW,
      imgH: fitted.imgH,
      stageW,
      stageH,
    });
  };

  const startDrag = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-float-close]")) return;
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: floatPos.x,
      originY: floatPos.y,
    };
    setDragging(true);
  };

  const pageCardStyle = {
    aspectRatio: `${aspect}`,
    width: `min(100cqw, calc(100cqh * ${aspect}))`,
    height: `min(100cqh, calc(100cqw / ${aspect}))`,
    maxWidth: "100%",
    maxHeight: "100%",
    transition: "width 280ms ease, height 280ms ease, aspect-ratio 280ms ease",
  } as const;

  return (
    <section className="flex h-full min-h-0 flex-col gap-1">
      <header className="flex shrink-0 items-center gap-2 px-0.5 leading-none">
        {showHeaderBack ? (
          <button
            type="button"
            onClick={() => router.push("/")}
            aria-label={cs.backAria}
            title={cs.backAria}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white/80 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : null}
        <h2 className="shrink-0 text-[12px] font-semibold tracking-tight text-slate-200 [word-break:keep-all] sm:text-[13px]">
          {cs.printTitle}
        </h2>
        <div className="min-w-0 flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <CanvasUploadToolbar
            dense
            nowrap
            className="justify-start"
            actions={toolbarMode === "delete-only" ? "delete-only" : "full"}
            disabled={exportBusy || generating}
            requireSubscription={requireSubscription}
            onLoadRecentProject={
              toolbarMode === "delete-only"
                ? undefined
                : (project) => {
                    if (onOpenRecentProject) {
                      onOpenRecentProject(project);
                      return;
                    }
                    stashPendingStudioProject(project);
                    showToast(
                      "최근 수정파일을 불러왔습니다. 스튜디오로 이동합니다.",
                      "success"
                    );
                    router.push(PRINT_STUDIO_PATH);
                  }
            }
          />
        </div>
      </header>

      <div
        className="flex min-h-0 flex-1 flex-col gap-1.5 rounded-2xl border border-slate-800 bg-[#121824] p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.35)] sm:gap-2 sm:p-2"
        onPointerDown={handleChromePointerDown}
      >
        <div
          ref={previewContainerRef}
          className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl border border-slate-800 bg-[#0E1420] snap-y snap-mandatory"
        >
          {Array.from({ length: totalPages }, (_, index) => {
            const pageNum = index + 1;
            const pageBg = backgroundUrls[index] || backgroundUrl || null;
            const pageBlueprint = shouldShowPrintBlueprint(formatId, useId)
              ? resolvePrintBlueprint(
                  formatId,
                  useId,
                  pageCount,
                  index,
                  customSize
                )
              : null;
            return (
              <div
                key={pageNum}
                id={`preview-page-${pageNum}`}
                data-preview-page={pageNum}
                className="flex h-full min-h-full w-full shrink-0 snap-start items-center justify-center p-1.5 sm:p-2 [container-type:size]"
              >
                <div
                  data-page-card
                  role={pageBg ? "button" : undefined}
                  tabIndex={pageBg ? 0 : undefined}
                  aria-label={
                    pageBg ? `${pageNum}페이지 배경 확대 보기` : undefined
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!pageBg) return;
                    if ((e.target as HTMLElement).closest("[data-text-layer]")) {
                      return;
                    }
                    openLightbox(pageBg, pageNum, e.currentTarget);
                  }}
                  onKeyDown={(e) => {
                    if (!pageBg) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      openLightbox(pageBg, pageNum, e.currentTarget);
                    }
                  }}
                  className={`relative overflow-hidden rounded-md border border-slate-700/70 bg-[#0B0F19] shadow-[0_12px_36px_rgba(0,0,0,0.4)] ${
                    pageBg
                      ? "cursor-zoom-in outline-none ring-indigo-400/0 transition hover:ring-2 hover:ring-indigo-400/40 focus-visible:ring-2 focus-visible:ring-indigo-400/50"
                      : ""
                  }`}
                  style={pageCardStyle}
                >
                  <div
                    data-page-stage
                    className="absolute inset-0 overflow-hidden"
                    style={{ transformOrigin: "top left" }}
                  >
                  {pageBg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={`${pageNum}-${pageBg.slice(0, 48)}`}
                      src={pageBg}
                      alt=""
                      className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                      style={{ animation: "pw-fade-in 0.7s ease forwards" }}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(99,102,241,0.22),transparent_55%),radial-gradient(ellipse_at_80%_80%,rgba(16,185,129,0.12),transparent_50%),linear-gradient(160deg,#121824,#0B0F19)]" />
                  )}

                  {/* Form-to-Design: draggable text boxes over pure visual bg. */}
                  {overlayLayersByPage?.[index]?.length &&
                  onOverlayLayersChange ? (
                    <div data-text-overlay className="pointer-events-none absolute inset-0 z-[2]">
                      <PreviewTextOverlay
                        layers={overlayLayersByPage[index]}
                        onLayersChange={(layers) =>
                          onOverlayLayersChange(index, layers)
                        }
                        interactive={
                          textOverlayInteractive &&
                          currentPage === pageNum &&
                          !lightbox
                        }
                        activeLayerId={
                          currentPage === pageNum ? activeTextLayerId : null
                        }
                        onActiveLayerChange={onActiveTextLayerChange}
                      />
                    </div>
                  ) : (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 z-[2] flex flex-col px-[8%] py-[7%] text-center"
                    >
                      {datePreview.trim() ? (
                        <p className="shrink-0 text-[clamp(9px,2.1cqw,13px)] font-medium tracking-wide text-black drop-shadow-[0_1px_2px_rgba(255,255,255,0.5)] [word-break:keep-all]">
                          {datePreview.trim()}
                        </p>
                      ) : null}
                      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1">
                        {titlePreview.trim() ? (
                          <p className="line-clamp-3 text-[clamp(14px,4.2cqw,28px)] font-extrabold leading-tight text-black drop-shadow-[0_1px_3px_rgba(255,255,255,0.45)] [word-break:keep-all]">
                            {titlePreview.trim()}
                          </p>
                        ) : null}
                        {subtitlePreview.trim() ? (
                          <p className="line-clamp-2 text-[clamp(10px,2.4cqw,15px)] font-medium text-black drop-shadow-[0_1px_2px_rgba(255,255,255,0.4)] [word-break:keep-all]">
                            {subtitlePreview.trim()}
                          </p>
                        ) : null}
                      </div>
                      <div className="shrink-0 space-y-0.5">
                        {locationPreview.trim() ? (
                          <p className="line-clamp-2 text-[clamp(9px,2cqw,12px)] text-black drop-shadow-[0_1px_2px_rgba(255,255,255,0.4)] [word-break:keep-all]">
                            {locationPreview.trim()}
                          </p>
                        ) : null}
                        {organizerPreview.trim() ? (
                          <p className="line-clamp-1 text-[clamp(8px,1.8cqw,11px)] text-black/90 drop-shadow-[0_1px_2px_rgba(255,255,255,0.35)] [word-break:keep-all]">
                            {organizerPreview.trim()}
                          </p>
                        ) : null}
                        {programsPreview.trim() ? (
                          <p className="line-clamp-3 whitespace-pre-line text-[clamp(8px,1.7cqw,11px)] text-black/85 drop-shadow-[0_1px_2px_rgba(255,255,255,0.35)] [word-break:keep-all]">
                            {programsPreview.trim()}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  )}

                  {pageBlueprint ? (
                    <PrintBlueprintOverlay
                      blueprint={pageBlueprint}
                      foldGuidesHidden={foldGuidesHidden}
                      onHideFoldGuides={onHideFoldGuides}
                      removeFoldLabel={cs.removeFoldGuides}
                    />
                  ) : null}

                  <span className="pointer-events-none absolute top-2 left-2 z-[3] rounded bg-indigo-600/85 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    {fillCanvas(cs.pageOf, { page: pageNum, total: totalPages })}
                  </span>
                  </div>
                </div>
              </div>
            );
          })}

          {generating ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#0B0F19]/70 backdrop-blur-[2px]">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-300" />
              <p className="text-xs font-medium text-slate-300">
                {cs.bgGenerating}
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex min-h-[3.25rem] shrink-0 items-center gap-1.5 overflow-x-auto rounded-lg border border-slate-800 bg-[#0E1420] px-1.5 py-1">
          <span className="shrink-0 whitespace-nowrap text-[10px] font-medium text-slate-500">
            {fillCanvas(cs.miniView, { label: pageLabel })}
          </span>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, index) => {
              const pageNum = index + 1;
              const isSelected = currentPage === pageNum;
              const thumbBg = backgroundUrls[index] || backgroundUrl || null;
              return (
                <button
                  key={pageNum}
                  type="button"
                  data-mini-thumb
                  onClick={(e) => {
                    e.stopPropagation();
                    handleThumbnailClick(pageNum);
                    openLightboxForPage(pageNum);
                  }}
                  aria-label={`${pageNum}면 미리보기`}
                  aria-pressed={isSelected}
                  className={`relative flex h-11 w-11 shrink-0 flex-col items-center justify-end overflow-hidden rounded border text-[10px] transition ${
                    isSelected
                      ? "border-indigo-500 shadow-[0_0_0_1px_rgba(99,102,241,0.25)]"
                      : "border-slate-700 hover:border-slate-500"
                  }`}
                >
                  {thumbBg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbBg}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[#1a2234]" />
                  )}
                  <span
                    className={`relative z-[1] mb-0.5 rounded bg-black/55 px-1 py-px text-[8px] font-bold ${
                      isSelected ? "text-indigo-200" : "text-white/85"
                    }`}
                  >
                    {fillCanvas(cs.pageFace, { page: pageNum })}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {lightbox && typeof document !== "undefined"
        ? createPortal(
            <div
              data-preview-lightbox-root
              className="pointer-events-none fixed inset-0"
              style={{ zIndex: LIGHTBOX_Z }}
            >
            <div
              role="dialog"
              aria-modal="false"
              data-preview-lightbox
              aria-label={`${lightbox.pageNum}페이지 확대 미리보기`}
              className="pointer-events-auto absolute flex max-h-[min(88vh,calc(100dvh-4.75rem))] max-w-[min(72vw,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-600/80 bg-[#121824] shadow-[0_24px_64px_rgba(0,0,0,0.55)] ring-1 ring-black/40"
              onPointerDown={(e) => {
                e.stopPropagation();
              }}
              style={{
                left: floatPos.x,
                top: floatPos.y,
                width: floatOuterW,
                height: floatOuterH,
                boxSizing: "border-box",
                transformOrigin: "top left",
              }}
            >
              <header
                onPointerDown={startDrag}
                className={`flex h-10 shrink-0 cursor-grab items-center justify-between gap-2 border-b border-slate-700/80 bg-[#0E1420] px-3 select-none ${
                  dragging ? "cursor-grabbing" : ""
                }`}
              >
                <p className="min-w-0 truncate text-[12px] font-semibold text-slate-100">
                  {fillCanvas(cs.pageOf, {
                    page: lightbox.pageNum,
                    total: totalPages,
                  })}
                </p>
                <button
                  type="button"
                  data-float-close
                  aria-label="닫기"
                  onClick={() => setLightbox(null)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-600 bg-slate-800/80 text-slate-200 transition hover:border-slate-500 hover:bg-slate-700 hover:text-white"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </header>

              <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto overscroll-contain bg-[#0B0F19] p-2">
                <div
                  data-page-stage
                  className="relative overflow-hidden"
                  style={{
                    width: lightbox.imgW,
                    height: lightbox.imgH,
                    transformOrigin: "top left",
                  }}
                >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={lightbox.src}
                  alt={`${lightbox.pageNum}페이지 확대`}
                  draggable={false}
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                />
                {overlayLayersByPage?.[lightbox.pageNum - 1]?.length &&
                onOverlayLayersChange ? (
                  <div
                    data-text-overlay
                    className="pointer-events-none absolute inset-0 z-[2]"
                  >
                    <PreviewTextOverlay
                      layers={overlayLayersByPage[lightbox.pageNum - 1]}
                      onLayersChange={(layers) =>
                        onOverlayLayersChange(lightbox.pageNum - 1, layers)
                      }
                      interactive={textOverlayInteractive}
                      activeLayerId={activeTextLayerId}
                      onActiveLayerChange={onActiveTextLayerChange}
                    />
                  </div>
                ) : (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 z-[2] flex flex-col px-[8%] py-[7%] text-center"
                  >
                    {datePreview.trim() ? (
                      <p className="shrink-0 text-[clamp(12px,2.1cqw,18px)] font-medium tracking-wide text-black drop-shadow-[0_1px_2px_rgba(255,255,255,0.5)] [word-break:keep-all]">
                        {datePreview.trim()}
                      </p>
                    ) : null}
                    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1">
                      {titlePreview.trim() ? (
                        <p className="line-clamp-3 text-[clamp(18px,4.2cqw,36px)] font-extrabold leading-tight text-black drop-shadow-[0_1px_3px_rgba(255,255,255,0.45)] [word-break:keep-all]">
                          {titlePreview.trim()}
                        </p>
                      ) : null}
                      {subtitlePreview.trim() ? (
                        <p className="line-clamp-2 text-[clamp(12px,2.4cqw,20px)] font-medium text-black drop-shadow-[0_1px_2px_rgba(255,255,255,0.4)] [word-break:keep-all]">
                          {subtitlePreview.trim()}
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0 space-y-0.5">
                      {locationPreview.trim() ? (
                        <p className="line-clamp-2 text-[clamp(11px,2cqw,16px)] text-black drop-shadow-[0_1px_2px_rgba(255,255,255,0.4)] [word-break:keep-all]">
                          {locationPreview.trim()}
                        </p>
                      ) : null}
                      {organizerPreview.trim() ? (
                        <p className="line-clamp-1 text-[clamp(10px,1.8cqw,14px)] text-black/90 drop-shadow-[0_1px_2px_rgba(255,255,255,0.35)] [word-break:keep-all]">
                          {organizerPreview.trim()}
                        </p>
                      ) : null}
                      {programsPreview.trim() ? (
                        <p className="line-clamp-6 whitespace-pre-line text-[clamp(10px,1.7cqw,14px)] text-black/85 drop-shadow-[0_1px_2px_rgba(255,255,255,0.35)] [word-break:keep-all]">
                          {programsPreview.trim()}
                        </p>
                      ) : null}
                    </div>
                  </div>
                )}
                </div>
              </div>
            </div>
            </div>,
            document.body
          )
        : null}
    </section>
  );
}
