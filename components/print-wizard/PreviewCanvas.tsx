"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import CanvasUploadToolbar from "@/components/canvas/CanvasUploadToolbar";
import { useCanvasStore } from "@/lib/canvas/canvasStore";
import {
  pageCountLabel,
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
};

type LightboxState = {
  src: string;
  pageNum: number;
  /** Image area size = 2× source preview card */
  imgW: number;
  imgH: number;
};

const HEADER_H = 40;
const BODY_PAD = 16; // p-2 × 2
const EDGE_GAP = 12;

export default function PreviewCanvas({
  formatId,
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
}: PreviewCanvasProps) {
  const aspect = resolvePrintAspect(formatId, customSize);
  const totalPages = pageCount;
  const pageLabel = pageCountLabel(pageCount);

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

  const sectionRef = useRef<HTMLElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [floatPos, setFloatPos] = useState({ x: EDGE_GAP, y: 72 });
  const [dragging, setDragging] = useState(false);

  const floatOuterW = lightbox
    ? lightbox.imgW + BODY_PAD
    : 420;
  const floatOuterH = lightbox
    ? lightbox.imgH + HEADER_H + BODY_PAD
    : 560;

  useEffect(() => {
    setCurrentPage((prev) => Math.min(Math.max(1, prev), totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox]);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const nextX = d.originX + (e.clientX - d.startX);
      const nextY = d.originY + (e.clientY - d.startY);
      const maxX = Math.max(0, window.innerWidth - 120);
      const maxY = Math.max(0, window.innerHeight - 64);
      setFloatPos({
        x: Math.min(maxX, Math.max(-floatOuterW + 120, nextX)),
        y: Math.min(maxY, Math.max(0, nextY)),
      });
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
  }, [dragging, floatOuterW]);

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
        if (bestRatio >= 0) setCurrentPage(best);
      },
      { root, threshold: [0.35, 0.55, 0.75, 1] }
    );

    for (const el of pages) observer.observe(el);
    return () => observer.disconnect();
  }, [totalPages, aspect]);

  const handleThumbnailClick = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    const root = previewContainerRef.current;
    if (!root) return;
    const target = root.querySelector(`#preview-page-${pageNumber}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  const openLightbox = (
    src: string,
    pageNum: number,
    cardEl: HTMLElement
  ) => {
    const card = cardEl.getBoundingClientRect();
    // Exactly 2× the on-screen preview card
    const imgW = Math.max(1, Math.round(card.width * 2));
    const imgH = Math.max(1, Math.round(card.height * 2));
    const winW = imgW + BODY_PAD;
    const winH = imgH + HEADER_H + BODY_PAD;

    const panelLeft =
      sectionRef.current?.getBoundingClientRect().left ?? EDGE_GAP;
    const x = Math.max(EDGE_GAP, Math.round(panelLeft));
    const y = Math.max(
      64,
      Math.min(
        Math.round(card.top),
        Math.max(64, window.innerHeight - winH - EDGE_GAP)
      )
    );

    setFloatPos({ x, y });
    setLightbox({ src, pageNum, imgW, imgH });
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
  } as const;

  return (
    <section
      ref={sectionRef}
      className="flex h-full min-h-0 flex-col gap-1"
    >
      <header className="flex shrink-0 items-center gap-2 px-0.5 leading-none">
        <h2 className="shrink-0 text-[12px] font-semibold tracking-tight text-slate-200 [word-break:keep-all] sm:text-[13px]">
          AI 뚝딱 생성기
        </h2>
        <div className="min-w-0 flex-1">
          <CanvasUploadToolbar dense className="justify-start" />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 rounded-2xl border border-slate-800 bg-[#121824] p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.35)] sm:gap-2 sm:p-2">
        <div
          ref={previewContainerRef}
          className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl border border-slate-800 bg-[#0E1420] snap-y snap-mandatory"
        >
          {Array.from({ length: totalPages }, (_, index) => {
            const pageNum = index + 1;
            const pageBg = backgroundUrls[index] || backgroundUrl || null;
            return (
              <div
                key={pageNum}
                id={`preview-page-${pageNum}`}
                data-preview-page={pageNum}
                className="flex h-full min-h-full w-full shrink-0 snap-start items-center justify-center p-1.5 sm:p-2 [container-type:size]"
              >
                <div
                  role={pageBg ? "button" : undefined}
                  tabIndex={pageBg ? 0 : undefined}
                  aria-label={
                    pageBg ? `${pageNum}페이지 배경 확대 보기` : undefined
                  }
                  onClick={(e) => {
                    if (!pageBg) return;
                    openLightbox(pageBg, pageNum, e.currentTarget);
                  }}
                  onKeyDown={(e) => {
                    if (!pageBg) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
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
                  {pageBg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={`${pageNum}-${pageBg.slice(0, 48)}`}
                      src={pageBg}
                      alt=""
                      className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                      style={{ animation: "pw-fade-in 0.7s ease forwards" }}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(99,102,241,0.22),transparent_55%),radial-gradient(ellipse_at_80%_80%,rgba(16,185,129,0.12),transparent_50%),linear-gradient(160deg,#121824,#0B0F19)]" />
                  )}

                  {/* Form-to-Design: HTML text layers over pure visual bg (never burned into Flux). */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 z-[2] flex flex-col px-[8%] py-[7%] text-center"
                  >
                    {datePreview.trim() ? (
                      <p className="shrink-0 text-[clamp(9px,2.1cqw,13px)] font-medium tracking-wide text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)] [word-break:keep-all]">
                        {datePreview.trim()}
                      </p>
                    ) : null}
                    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1">
                      {titlePreview.trim() ? (
                        <p className="line-clamp-3 text-[clamp(14px,4.2cqw,28px)] font-extrabold leading-tight text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)] [word-break:keep-all]">
                          {titlePreview.trim()}
                        </p>
                      ) : null}
                      {subtitlePreview.trim() ? (
                        <p className="line-clamp-2 text-[clamp(10px,2.4cqw,15px)] font-medium text-amber-100/95 drop-shadow-[0_1px_3px_rgba(0,0,0,0.65)] [word-break:keep-all]">
                          {subtitlePreview.trim()}
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0 space-y-0.5">
                      {locationPreview.trim() ? (
                        <p className="line-clamp-2 text-[clamp(9px,2cqw,12px)] text-white/88 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)] [word-break:keep-all]">
                          {locationPreview.trim()}
                        </p>
                      ) : null}
                      {organizerPreview.trim() ? (
                        <p className="line-clamp-1 text-[clamp(8px,1.8cqw,11px)] text-white/75 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)] [word-break:keep-all]">
                          {organizerPreview.trim()}
                        </p>
                      ) : null}
                      {programsPreview.trim() ? (
                        <p className="line-clamp-3 whitespace-pre-line text-[clamp(8px,1.7cqw,11px)] text-white/70 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)] [word-break:keep-all]">
                          {programsPreview.trim()}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <span className="pointer-events-none absolute top-2 left-2 z-[3] rounded bg-indigo-600/85 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    {pageNum}페이지 / 총 {totalPages}면
                  </span>
                </div>
              </div>
            );
          })}

          {generating ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#0B0F19]/70 backdrop-blur-[2px]">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-300" />
              <p className="text-xs font-medium text-slate-300">
                AI 배경 생성 중…
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex min-h-[3.25rem] shrink-0 items-center gap-1.5 overflow-x-auto rounded-lg border border-slate-800 bg-[#0E1420] px-1.5 py-1">
          <span className="shrink-0 whitespace-nowrap text-[10px] font-medium text-slate-500">
            미니 보기 ({pageLabel})
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
                  onClick={() => handleThumbnailClick(pageNum)}
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
                    {pageNum}면
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
              role="dialog"
              aria-label={`${lightbox.pageNum}페이지 확대 미리보기`}
              className="fixed z-[400] flex flex-col overflow-hidden rounded-2xl border border-slate-600/80 bg-[#121824] shadow-[0_24px_64px_rgba(0,0,0,0.55)] ring-1 ring-black/40"
              style={{
                left: floatPos.x,
                top: floatPos.y,
                width: floatOuterW,
                height: floatOuterH,
              }}
            >
              <header
                onPointerDown={startDrag}
                className={`flex h-10 shrink-0 cursor-grab items-center justify-between gap-2 border-b border-slate-700/80 bg-[#0E1420] px-3 select-none ${
                  dragging ? "cursor-grabbing" : ""
                }`}
              >
                <p className="min-w-0 truncate text-[12px] font-semibold text-slate-100">
                  {lightbox.pageNum}페이지 / 총 {totalPages}면
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

              <div className="flex shrink-0 items-center justify-center bg-[#0B0F19] p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={lightbox.src}
                  alt={`${lightbox.pageNum}페이지 확대`}
                  draggable={false}
                  className="block object-contain"
                  style={{
                    width: lightbox.imgW,
                    height: lightbox.imgH,
                  }}
                />
              </div>
            </div>,
            document.body
          )
        : null}
    </section>
  );
}
