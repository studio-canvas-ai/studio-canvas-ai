"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight } from "lucide-react";
import ImageComparisonSlider from "@/components/ImageComparisonSlider";
import { useI18n } from "@/components/I18nProvider";
import { getStylePreviewPair } from "@/lib/stylePreviewPairs";

export type StylePreviewSide = "left" | "right";

/** Bounding box of the left or right 2×2 card zone (viewport coords). */
export type StylePreviewAnchor = {
  side: StylePreviewSide;
  left: number;
  top: number;
  width: number;
  height: number;
  midX: number;
  midY: number;
};

type StyleCompareHoverPopupProps = {
  styleId: string;
  styleName: string;
  open: boolean;
  /** Zone rect — popup is centered inside this box */
  anchor: StylePreviewAnchor | null;
  onKeepOpen: () => void;
  onRequestClose: () => void;
  onMakeWithStyle: (styleId: string) => void;
  onExited?: () => void;
};

const EXIT_MS = 200;
const VIEW_PAD = 10;
/** Keep a rim of the 2×2 cards visible around the panel. */
const ZONE_INSET_RATIO = 0.11;
const PANEL_WIDTH_RATIO = 0.78;

type PanelBox = { left: number; top: number; width: number };

/**
 * Hover overlay centered in the hovered card’s 2×2 zone (left or right group).
 */
export default function StyleCompareHoverPopup({
  styleId,
  styleName,
  open,
  anchor,
  onKeepOpen,
  onRequestClose,
  onMakeWithStyle,
  onExited,
}: StyleCompareHoverPopupProps) {
  const { t } = useI18n();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [rendered, setRendered] = useState(open);
  const [visible, setVisible] = useState(false);
  const [activeStyleId, setActiveStyleId] = useState(styleId);
  const [activeName, setActiveName] = useState(styleName);
  const [activeAnchor, setActiveAnchor] = useState<StylePreviewAnchor | null>(
    anchor
  );
  const [panelBox, setPanelBox] = useState<PanelBox | null>(null);
  const sliderDraggingRef = useRef(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) {
      setActiveStyleId(styleId);
      setActiveName(styleName);
      if (anchor) setActiveAnchor(anchor);
      setRendered(true);
      const show = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setVisible(true));
      });
      return () => window.cancelAnimationFrame(show);
    }
    setVisible(false);
    const tId = window.setTimeout(() => {
      setRendered(false);
      onExited?.();
    }, EXIT_MS);
    return () => window.clearTimeout(tId);
  }, [open, styleId, styleName, anchor, onExited]);

  useEffect(() => {
    if (!open) return;
    setActiveStyleId(styleId);
    setActiveName(styleName);
    if (anchor) setActiveAnchor(anchor);
  }, [open, styleId, styleName, anchor]);

  // Center the panel inside the 2×2 zone (same spot for every card in that zone)
  useLayoutEffect(() => {
    if (!rendered || !activeAnchor) {
      setPanelBox(null);
      return;
    }

    const place = () => {
      const el = panelRef.current;
      if (!el) return;

      const zone = activeAnchor;
      const maxW = Math.max(240, zone.width * (1 - ZONE_INSET_RATIO * 2));
      const width = Math.min(
        maxW,
        Math.max(260, zone.width * PANEL_WIDTH_RATIO)
      );
      const maxH = Math.min(
        window.innerHeight - VIEW_PAD * 2,
        Math.max(300, zone.height * (1 - ZONE_INSET_RATIO * 2))
      );

      // Apply size before measuring height (4:5 compare + chrome)
      el.style.width = `${width}px`;
      el.style.maxHeight = `${maxH}px`;
      const height = Math.min(el.offsetHeight || width * 1.45, maxH);

      const insetX = zone.width * ZONE_INSET_RATIO;
      const insetY = zone.height * ZONE_INSET_RATIO;
      const minLeft = zone.left + insetX;
      const maxLeft = zone.left + zone.width - insetX - width;
      const minTop = zone.top + insetY;
      const maxTop = zone.top + zone.height - insetY - height;

      let left = zone.midX - width / 2;
      let top = zone.midY - height / 2;

      if (maxLeft >= minLeft) {
        left = Math.min(maxLeft, Math.max(minLeft, left));
      } else {
        left = zone.midX - width / 2;
      }
      if (maxTop >= minTop) {
        top = Math.min(maxTop, Math.max(minTop, top));
      } else {
        top = zone.midY - height / 2;
      }

      // Viewport clamp (scroll / short screens)
      left = Math.min(
        window.innerWidth - width - VIEW_PAD,
        Math.max(VIEW_PAD, left)
      );
      top = Math.min(
        window.innerHeight - Math.min(height, window.innerHeight - VIEW_PAD * 2) - VIEW_PAD,
        Math.max(VIEW_PAD, top)
      );

      setPanelBox({ left, top, width });
    };

    place();
    const ro =
      typeof ResizeObserver !== "undefined" && panelRef.current
        ? new ResizeObserver(place)
        : null;
    if (panelRef.current && ro) ro.observe(panelRef.current);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [rendered, activeAnchor, activeStyleId, visible]);

  if (!mounted || !rendered) return null;

  const preview = getStylePreviewPair(activeStyleId);
  const side: StylePreviewSide = activeAnchor?.side ?? "left";

  const content = (
    <div className="pointer-events-none fixed inset-0 z-[80]" role="presentation">
      {/* No full-screen dim — gallery cards stay bright and readable */}

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        style={{
          left: panelBox?.left ?? 0,
          top: panelBox?.top ?? 0,
          width: panelBox?.width,
          opacity: panelBox ? undefined : 0,
          transform: visible
            ? "translate(0, 0)"
            : side === "left"
              ? "translate(-4px, 4px)"
              : "translate(4px, 4px)",
        }}
        className={`pointer-events-auto absolute z-[1] flex max-h-[min(92vh,900px)] flex-col overflow-hidden rounded-2xl border border-white/14 bg-[#0a0b12]/97 shadow-[0_28px_90px_rgba(0,0,0,0.55)] transition-[opacity,transform] duration-200 ease-out ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        onMouseEnter={onKeepOpen}
        onMouseLeave={() => {
          // Don't dismiss while the user is dragging the compare handle
          if (sliderDraggingRef.current) return;
          onRequestClose();
        }}
      >
        <div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
          <div className="shrink-0 border-b border-white/8 px-3.5 py-2.5 sm:px-4 sm:py-3">
            <p className="text-[10px] font-semibold tracking-[0.18em] text-glow-emerald uppercase">
              {t.styles.eyebrow}
            </p>
            <h2
              id={titleId}
              className="font-display mt-0.5 text-base font-bold text-white sm:text-lg"
            >
              {activeName}
            </h2>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden px-2.5 py-2.5 sm:px-3.5 sm:py-3">
            <ImageComparisonSlider
              key={activeStyleId}
              beforeSrc={preview.before}
              afterSrc={preview.after}
              beforeLabel={t.hero.before}
              afterLabel={t.hero.after}
              ariaLabel={`${activeName} — ${t.hero.before} / ${t.hero.after}`}
              className="style-gallery-compare w-full"
              frameClassName="style-gallery-compare__frame"
              initialPosition={48}
              idleDemo
              onDragChange={(next) => {
                sliderDraggingRef.current = next;
                if (next) onKeepOpen();
              }}
            />
          </div>

          <div className="shrink-0 border-t border-white/8 px-3.5 py-3 sm:px-4 sm:py-3.5">
            <button
              type="button"
              onClick={() => onMakeWithStyle(preview.packId)}
              className="btn-primary flex w-full items-center justify-center gap-2 py-2.5 text-sm font-bold sm:py-3 sm:text-base"
            >
              <span className="truncate">{t.creator.makeWithStyle}</span>
              <ArrowUpRight className="h-4 w-4 shrink-0" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

/** Build an anchor from a left/right 2×2 zone element. */
export function previewAnchorFromZone(
  zoneEl: HTMLElement,
  side: StylePreviewSide
): StylePreviewAnchor {
  const r = zoneEl.getBoundingClientRect();
  return {
    side,
    left: r.left,
    top: r.top,
    width: r.width,
    height: r.height,
    midX: r.left + r.width / 2,
    midY: r.top + r.height / 2,
  };
}
