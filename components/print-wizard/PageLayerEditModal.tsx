"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { fillCanvas } from "@/lib/i18n";
import PageLayerEditor from "@/components/print-wizard/PageLayerEditor";
import type { TextLayer } from "@/lib/thumbnailStyles";

export type PageLayerEditModalProps = {
  page: number;
  totalPages: number;
  layers: TextLayer[];
  activeLayerId?: string | null;
  onActiveLayerChange?: (id: string | null) => void;
  onLayerTextChange: (layerId: string, text: string) => void;
  onAddAfter: (nextLayers: TextLayer[]) => void;
  onDelete: (layerId: string) => void;
  onClose: () => void;
};

const NAV_H = 64;
const EDGE = 16;
/** Previous width min(42rem, 72vw) × 0.75 */
const WIDTH_PX = Math.round(42 * 16 * 0.75); // 504
const WIDTH_VW = 54; // 72 * 0.75
const HEADER_H = 40;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function modalWidth() {
  if (typeof window === "undefined") return WIDTH_PX;
  return Math.max(280, Math.min(WIDTH_PX, Math.round((window.innerWidth * WIDTH_VW) / 100)));
}

function modalHeight() {
  if (typeof window === "undefined") return 560;
  return Math.max(
    280,
    Math.min(
      Math.round(window.innerHeight * 0.88),
      window.innerHeight - NAV_H - EDGE
    )
  );
}

/** Sit in the center-right gutter, left of the detail-content panel, never flush-left. */
function defaultOrigin(width: number, height: number) {
  if (typeof window === "undefined") {
    return { x: 420, y: NAV_H };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const form = document.querySelector<HTMLElement>("[data-wizard-form]");
  const formLeft = form?.getBoundingClientRect().left;
  const rightGutter =
    typeof formLeft === "number" && formLeft > vw * 0.4
      ? formLeft - EDGE
      : Math.round(vw * 0.78);
  const minX = Math.round(vw * 0.38);
  const x = clamp(rightGutter - width, minX, Math.max(minX, vw - width - EDGE));
  const y = clamp(
    Math.round(NAV_H + (vh - NAV_H - height) / 2),
    NAV_H,
    Math.max(NAV_H, vh - height - EDGE)
  );
  return { x, y };
}

/**
 * Layer-edit dialog as a body-level fixed window (no full-screen overlay).
 * 75% of prior width, opens center-right, title bar is mouse-draggable.
 */
export default function PageLayerEditModal({
  page,
  totalPages,
  layers,
  activeLayerId = null,
  onActiveLayerChange,
  onLayerTextChange,
  onAddAfter,
  onDelete,
  onClose,
}: PageLayerEditModalProps) {
  const { t } = useI18n();
  const cs = t.canvasStudio;
  const headerRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: 420, y: NAV_H });
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const [size, setSize] = useState(() => ({
    width: WIDTH_PX,
    height: 560,
  }));
  const [pos, setPos] = useState(() => ({ x: 420, y: NAV_H }));
  const [dragging, setDragging] = useState(false);
  const [mounted, setMounted] = useState(false);

  const applyPos = useCallback((next: { x: number; y: number }) => {
    posRef.current = next;
    setPos(next);
  }, []);

  useLayoutEffect(() => {
    const width = modalWidth();
    const height = modalHeight();
    setSize({ width, height });
    const origin = defaultOrigin(width, height);
    applyPos(origin);
    setMounted(true);
  }, [applyPos]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const onMouseMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      e.preventDefault();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = size.width;
      const h = size.height;
      applyPos({
        x: clamp(d.originX + (e.clientX - d.startX), EDGE - w + HEADER_H, vw - EDGE - HEADER_H),
        y: clamp(d.originY + (e.clientY - d.startY), NAV_H, vh - HEADER_H),
      });
    };

    const onMouseUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      setDragging(false);
      document.body.style.removeProperty("user-select");
      document.body.style.removeProperty("cursor");
      window.removeEventListener("mousemove", onMouseMove, true);
      window.removeEventListener("mouseup", onMouseUp, true);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest("[data-float-close]")) return;
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        originX: posRef.current.x,
        originY: posRef.current.y,
      };
      setDragging(true);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "grabbing";
      window.addEventListener("mousemove", onMouseMove, true);
      window.addEventListener("mouseup", onMouseUp, true);
    };

    header.addEventListener("mousedown", onMouseDown, true);
    return () => {
      header.removeEventListener("mousedown", onMouseDown, true);
      window.removeEventListener("mousemove", onMouseMove, true);
      window.removeEventListener("mouseup", onMouseUp, true);
      document.body.style.removeProperty("user-select");
      document.body.style.removeProperty("cursor");
    };
  }, [applyPos, size.height, size.width]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="false"
      data-page-layer-modal
      aria-label={fillCanvas(cs.pageOf, { page, total: totalPages })}
      className="fixed z-[450] flex flex-col overflow-hidden rounded-2xl border border-slate-600/80 bg-[#121824] shadow-[0_24px_64px_rgba(0,0,0,0.55)] ring-1 ring-black/40"
      style={{
        left: pos.x,
        top: pos.y,
        width: size.width,
        height: size.height,
        maxWidth: `${WIDTH_VW}vw`,
        maxHeight: "min(88vh, calc(100dvh - 4.75rem))",
        pointerEvents: "auto",
      }}
    >
      <div
        ref={headerRef}
        data-layer-modal-drag
        className={`flex h-10 shrink-0 items-center justify-between gap-2 border-b border-slate-700/80 bg-[#0E1420] px-3 select-none ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{ pointerEvents: "auto", touchAction: "none" }}
      >
        <p className="pointer-events-none min-w-0 truncate text-[12px] font-semibold text-slate-100">
          {fillCanvas(cs.pageOf, { page, total: totalPages })}
        </p>
        <button
          type="button"
          data-float-close
          aria-label="닫기"
          onClick={onClose}
          onMouseDown={(e) => e.stopPropagation()}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-600 bg-slate-800/80 text-slate-200 transition hover:border-slate-500 hover:bg-slate-700 hover:text-white"
          style={{ pointerEvents: "auto" }}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4"
        style={{ pointerEvents: "auto" }}
      >
        <PageLayerEditor
          page={page}
          layers={layers}
          activeLayerId={activeLayerId}
          onActiveLayerChange={onActiveLayerChange}
          onLayerTextChange={onLayerTextChange}
          onAddAfter={onAddAfter}
          onDelete={onDelete}
        />
      </div>
    </div>,
    document.body
  );
}
