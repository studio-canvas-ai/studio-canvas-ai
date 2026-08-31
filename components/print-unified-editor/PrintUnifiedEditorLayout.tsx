"use client";

import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Palette, X } from "lucide-react";

export type PrintUnifiedEditorLayoutProps = {
  canvas: ReactNode;
  controls: ReactNode;
  designPanel: ReactNode;
};

function readIsDesktop(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(min-width: 1024px)").matches;
}

/** Mobile split: canvas ~38vh, edit panel max ~42.5vh (50vh − 15%). */
const MOBILE_CANVAS_H = "h-[38vh] max-h-[40vh] min-h-[220px]";
const MOBILE_PANEL_MAX_H = "max-h-[42.5vh]";

/**
 * Screen 26 shell — left canvas (44%) | middle controls (26%) | right design tools (30%).
 * Mobile: split-screen (canvas top + tools bottom) — no overlay/backdrop/portal.
 */
export default function PrintUnifiedEditorLayout({
  canvas,
  controls,
  designPanel,
}: PrintUnifiedEditorLayoutProps) {
  const [styleSheetOpen, setStyleSheetOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(readIsDesktop);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      setIsDesktop(mq.matches);
      if (mq.matches) setStyleSheetOpen(false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!styleSheetOpen || !isDesktop) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStyleSheetOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isDesktop, styleSheetOpen]);

  const closeStyleSheet = useCallback(() => {
    setStyleSheetOpen(false);
  }, []);

  const mobileSplitActive = !isDesktop && styleSheetOpen;

  const mobileEditPanel = (
    <div
      id="unified-style-panel"
      data-unified-design-panel
      className={`pointer-events-auto flex min-h-0 w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-sm ${MOBILE_PANEL_MAX_H} flex-1`}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
        <p className="text-sm font-bold text-slate-900">
          AI 배경 · 스타일 · 데코 · 폰트
        </p>
        <button
          type="button"
          onClick={closeStyleSheet}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700"
          aria-label="닫기"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
        {designPanel}
      </div>
    </div>
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-transparent">
      <div
        className={
          mobileSplitActive
            ? "relative mx-auto flex h-full min-h-0 w-full max-w-[1920px] flex-1 flex-col gap-2 overflow-hidden px-3 py-2.5 pb-[calc(3.75rem+max(0.75rem,env(safe-area-inset-bottom)))]"
            : "relative mx-auto grid min-h-0 w-full max-w-[1920px] flex-1 grid-cols-1 gap-3 overflow-y-auto overscroll-contain px-3 py-2.5 pb-28 sm:px-4 sm:py-3 lg:h-full lg:grid-cols-[minmax(0,44fr)_minmax(0,26fr)_minmax(0,30fr)] lg:gap-3 lg:overflow-hidden lg:px-5 lg:pb-4"
        }
      >
        <div
          className={
            mobileSplitActive
              ? `${MOBILE_CANVAS_H} shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm`
              : "min-h-[320px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm lg:min-h-0 lg:h-full"
          }
        >
          {canvas}
        </div>

        <div
          className={
            mobileSplitActive
              ? "relative flex max-h-[22vh] min-h-0 shrink-0 flex-col overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white shadow-sm"
              : "relative flex min-h-0 w-full flex-1 flex-col overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white shadow-sm lg:h-full lg:min-h-0"
          }
        >
          {controls}
        </div>

        {mobileSplitActive ? mobileEditPanel : null}

        {isDesktop ? (
          <div
            data-unified-design-panel
            className="relative z-[500] flex min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white pointer-events-auto shadow-sm lg:h-full"
          >
            {designPanel}
          </div>
        ) : null}
      </div>

      {!isDesktop ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[500] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="pointer-events-auto mx-auto flex max-w-lg justify-center">
            <button
              type="button"
              aria-expanded={styleSheetOpen}
              onClick={() => setStyleSheetOpen((v) => !v)}
              className="inline-flex min-h-12 w-full max-w-sm items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-[0_10px_28px_rgba(79,70,229,0.45)] transition hover:bg-indigo-500 active:scale-[0.99]"
            >
              <Palette className="h-4 w-4 shrink-0" aria-hidden />
              {styleSheetOpen ? "편집 도구 닫기" : "편집 도구"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
