"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  onDuplicate: (layerId: string) => void;
  onDelete: (layerId: string) => void;
  onAddLayer: () => void;
  onClose: () => void;
};

const NAV_H = 64;
const EDGE = 12;
/** Previous width was min(42rem, 72vw); 25% narrower → 75% of that. */
const WIN_W_PX = Math.round(42 * 16 * 0.75); // 31.5rem
const WIN_MAX_VW = 0.54; // 72vw * 0.75
const MIN_VISIBLE = 80;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function panelSize() {
  const width = Math.max(
    280,
    Math.min(WIN_W_PX, Math.round(window.innerWidth * WIN_MAX_VW))
  );
  const height = Math.max(
    240,
    Math.min(
      Math.round(window.innerHeight * 0.88),
      window.innerHeight - NAV_H - EDGE
    )
  );
  return { width, height };
}

function defaultPos(width: number, height: number) {
  const form = document.querySelector<HTMLElement>("[data-wizard-form]");
  const formLeft = form?.getBoundingClientRect().left;
  const stacked = typeof formLeft !== "number" || formLeft < 360;
  const rightLimit = stacked
    ? window.innerWidth - EDGE
    : Math.max(EDGE + width, formLeft - EDGE);
  const x = clamp(rightLimit - width, EDGE, Math.max(EDGE, rightLimit - width));
  const y = clamp(
    Math.round(NAV_H + (window.innerHeight - NAV_H - height) / 2),
    NAV_H,
    Math.max(NAV_H, window.innerHeight - height - EDGE)
  );
  return { x, y };
}

function clampPos(x: number, y: number, width: number, height: number) {
  const maxX = Math.max(EDGE, window.innerWidth - MIN_VISIBLE);
  const maxY = Math.max(NAV_H, window.innerHeight - 48);
  return {
    x: clamp(x, MIN_VISIBLE - width, maxX),
    y: clamp(y, NAV_H, maxY),
  };
}

/**
 * Layer-edit dialog: 75% of previous width, default center-right, draggable header.
 * Does not block the right form — overlay is pointer-events none except the dialog.
 */
export default function PageLayerEditModal({
  page,
  totalPages,
  layers,
  activeLayerId = null,
  onActiveLayerChange,
  onLayerTextChange,
  onDuplicate,
  onDelete,
  onAddLayer,
  onClose,
}: PageLayerEditModalProps) {
  const { t } = useI18n();
  const cs = t.canvasStudio;
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const [size, setSize] = useState({ width: WIN_W_PX, height: 560 });
  const [pos, setPos] = useState({ x: EDGE, y: NAV_H });
  const [dragging, setDragging] = useState(false);

  useLayoutEffect(() => {
    const next = panelSize();
    setSize(next);
    setPos(defaultPos(next.width, next.height));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      setPos(
        clampPos(
          d.originX + (e.clientX - d.startX),
          d.originY + (e.clientY - d.startY),
          size.width,
          size.height
        )
      );
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
  }, [dragging, size.height, size.width]);

  const startDrag = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-float-close]")) return;
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: pos.x,
      originY: pos.y,
    };
    setDragging(true);
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      data-page-layer-modal-root
      className="pointer-events-none fixed inset-0 z-[450]"
    >
      <div
        role="dialog"
        aria-modal="false"
        aria-label={fillCanvas(cs.pageOf, { page, total: totalPages })}
        className="pointer-events-auto absolute flex flex-col overflow-hidden rounded-2xl border border-slate-600/80 bg-[#121824] shadow-[0_24px_64px_rgba(0,0,0,0.55)] ring-1 ring-black/40"
        style={{
          left: pos.x,
          top: pos.y,
          width: size.width,
          height: size.height,
          maxHeight: "min(88vh, calc(100dvh - 4.75rem))",
        }}
      >
        <header
          onPointerDown={startDrag}
          className={`flex h-10 shrink-0 cursor-grab items-center justify-between gap-2 border-b border-slate-700/80 bg-[#0E1420] px-3 select-none ${
            dragging ? "cursor-grabbing" : ""
          }`}
        >
          <p className="min-w-0 truncate text-[12px] font-semibold text-slate-100">
            {fillCanvas(cs.pageOf, { page, total: totalPages })}
          </p>
          <button
            type="button"
            data-float-close
            aria-label="닫기"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-600 bg-slate-800/80 text-slate-200 transition hover:border-slate-500 hover:bg-slate-700 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
          <PageLayerEditor
            layers={layers}
            activeLayerId={activeLayerId}
            onActiveLayerChange={onActiveLayerChange}
            onLayerTextChange={onLayerTextChange}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            onAddLayer={onAddLayer}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
