"use client";

import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
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

/**
 * Screen 26 shell — left canvas (44%) | middle controls (26%) | right design tools (30%).
 * Mobile: 50vh bottom sheet for style tools + in-page fallback stack.
 * designPanel is mounted once (desktop column XOR mobile portal).
 */
export default function PrintUnifiedEditorLayout({
  canvas,
  controls,
  designPanel,
}: PrintUnifiedEditorLayoutProps) {
  const [styleSheetOpen, setStyleSheetOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [isDesktop, setIsDesktop] = useState(readIsDesktop);
  const [mobileHost, setMobileHost] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    setPortalReady(true);
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
    if (!styleSheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStyleSheetOpen(false);
    };
    document.addEventListener("keydown", onKey);
    if (isDesktop) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", onKey);
        document.body.style.overflow = prev;
      };
    }
    return () => document.removeEventListener("keydown", onKey);
  }, [isDesktop, styleSheetOpen]);

  const closeStyleSheet = useCallback(() => {
    setStyleSheetOpen(false);
  }, []);

  const mobileSheetBottom =
    "calc(3.75rem + max(0.75rem, env(safe-area-inset-bottom)))";

  const mobilePanel =
    !isDesktop && portalReady && mobileHost
      ? createPortal(
          <>
            {styleSheetOpen ? (
              <button
                type="button"
                aria-label="닫기"
                className="fixed inset-0 z-[740] bg-slate-900/25 backdrop-blur-[1px]"
                onClick={closeStyleSheet}
              />
            ) : null}
            <div
              id="unified-style-panel"
              data-unified-design-panel
              style={styleSheetOpen ? { bottom: mobileSheetBottom } : undefined}
              className={
                styleSheetOpen
                  ? "pointer-events-auto fixed inset-x-0 z-[750] flex h-[50vh] max-h-[50dvh] flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-[0_-12px_40px_rgba(15,23,42,0.18)]"
                  : "pointer-events-auto relative flex min-h-[min(72vh,760px)] w-full flex-col overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white pb-24 shadow-sm"
              }
            >
              {styleSheetOpen ? (
                <>
                  <div
                    className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-300"
                    aria-hidden
                  />
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
                </>
              ) : null}
              <div
                className={
                  styleSheetOpen
                    ? "min-h-0 flex-1 overflow-y-auto overscroll-contain px-0 pb-3 [-webkit-overflow-scrolling:touch]"
                    : "flex min-h-[min(68vh,720px)] flex-1 flex-col"
                }
              >
                {designPanel}
              </div>
            </div>
          </>,
          styleSheetOpen ? document.body : mobileHost
        )
      : null;

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-transparent">
      <div className="relative mx-auto grid min-h-0 w-full max-w-[1920px] flex-1 grid-cols-1 gap-3 overflow-y-auto overscroll-contain px-3 py-2.5 pb-28 sm:px-4 sm:py-3 lg:h-full lg:grid-cols-[minmax(0,44fr)_minmax(0,26fr)_minmax(0,30fr)] lg:gap-3 lg:overflow-hidden lg:px-5 lg:pb-4">
        <div className="min-h-[320px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm lg:min-h-0 lg:h-full">
          {canvas}
        </div>
        <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white shadow-sm lg:h-full lg:min-h-0">
          {controls}
        </div>

        {!isDesktop ? (
          <div
            ref={setMobileHost}
            className={`relative z-[500] w-full ${
              styleSheetOpen ? "min-h-0" : "min-h-[min(72vh,760px)]"
            }`}
          />
        ) : null}

        {isDesktop ? (
          <div
            data-unified-design-panel
            className="relative z-[500] flex min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white pointer-events-auto shadow-sm lg:h-full"
          >
            {designPanel}
          </div>
        ) : null}
      </div>

      {mobilePanel}

      {!isDesktop ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[760] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="pointer-events-auto mx-auto flex max-w-lg justify-center">
            <button
              type="button"
              aria-expanded={styleSheetOpen}
              onClick={() => setStyleSheetOpen((v) => !v)}
              className="inline-flex min-h-12 w-full max-w-sm items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-[0_10px_28px_rgba(79,70,229,0.45)] transition hover:bg-indigo-500 active:scale-[0.99]"
            >
              <Palette className="h-4 w-4 shrink-0" aria-hidden />
              {styleSheetOpen ? "스타일 닫기" : "편집 도구"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
