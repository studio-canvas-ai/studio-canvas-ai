"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ClipboardCopy, Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import {
  collectSnapTargets,
  drawSnapGuides,
  rectFromBox,
  snapLayerRect,
  SNAP_THRESHOLD_PX,
  type SnapGuides,
} from "@/lib/canvas/snapGuides";
import { formatFormFieldText, formFieldFromLayerId, toPlainLayerListText } from "@/lib/printWizardTextFormat";
import {
  addPageTextLayerAfter,
  boxToLayerPatch,
  canvasTextScale,
  clampBoxAllowOverflow,
  layerToBox,
  layerZone,
  PAGE_ZONE_LABELS,
  removeTextLayer,
  stripLayerPlaceholderPrefix,
} from "@/lib/printWizardTextLayers";
import { drawPrintLayerInBox } from "@/lib/printWizardTextDraw";
import { colorPresetFill, fontForText, type TextLayer } from "@/lib/thumbnailStyles";
import { revealTextLayerField } from "@/lib/canvas/textLayerInteraction";

export type PreviewTextOverlayProps = {
  layers: TextLayer[];
  onLayersChange: (layers: TextLayer[]) => void;
  interactive?: boolean;
  activeLayerId?: string | null;
  onActiveLayerChange?: (id: string | null) => void;
  pageIndex?: number;
  backgroundSrc?: string | null;
  /** Screen 26 — always render empty zone guide boxes. */
  showEmptyGuideBoxes?: boolean;
  /** Screen 26 — hide 상단/중간/하단 placeholder labels inside guides. */
  hideGuideLabels?: boolean;
  /** Screen 26 — single click enters inline edit (not only double-click). */
  editOnSingleClick?: boolean;
  /**
   * CSS transform scale on an ancestor stage world.
   * Pointer deltas are divided by this so drag/resize stay 1:1 with the cursor.
   */
  viewScale?: number;
};

type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

type DragKind = "move" | "resize";

type DragState = {
  kind: DragKind;
  handle?: ResizeHandle;
  layerId: string;
  startClientX: number;
  startClientY: number;
  startBox: { x: number; y: number; width: number; height: number };
  liveBox: { x: number; y: number; width: number; height: number };
  pointerType: string;
  stageW: number;
  stageH: number;
};

const DRAG_THRESHOLD_PX = 4;
const CONTRAST_DARK_COLOR = "white" as const;
const CONTRAST_LIGHT_COLOR = "inkBlack" as const;

function textAlignClass(align: TextLayer["align"]): string {
  if (align === "left") return "justify-start text-left";
  if (align === "right") return "justify-end text-right";
  return "justify-center text-center";
}

function luminanceFromRgb(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function LayerTextCanvas({
  layer,
  width,
  height,
  scale,
}: {
  layer: TextLayer;
  width: number;
  height: number;
  scale: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width < 1 || height < 1) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    drawPrintLayerInBox(ctx, layer, width, height, scale);
  }, [layer, width, height, scale]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}

const HANDLES: Array<{ id: ResizeHandle; className: string; cursor: string }> = [
  { id: "nw", className: "left-0 top-0 -translate-x-1/2 -translate-y-1/2", cursor: "nwse-resize" },
  { id: "n", className: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2", cursor: "ns-resize" },
  { id: "ne", className: "right-0 top-0 translate-x-1/2 -translate-y-1/2", cursor: "nesw-resize" },
  { id: "e", className: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2", cursor: "ew-resize" },
  { id: "se", className: "bottom-0 right-0 translate-x-1/2 translate-y-1/2", cursor: "nwse-resize" },
  { id: "s", className: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2", cursor: "ns-resize" },
  { id: "sw", className: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2", cursor: "nesw-resize" },
  { id: "w", className: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2", cursor: "ew-resize" },
];

function applyResize(
  start: { x: number; y: number; width: number; height: number },
  dx: number,
  dy: number,
  handle: ResizeHandle
): { x: number; y: number; width: number; height: number } {
  const minW = 48;
  const minH = 16;
  let width = start.width;
  let height = start.height;
  let x = start.x;
  let y = start.y;

  if (handle.includes("e")) {
    width = Math.max(minW, start.width + dx);
  }
  if (handle.includes("w")) {
    width = Math.max(minW, start.width - dx);
    // Keep the right edge anchored when hitting min width.
    x = start.x + start.width - width;
  }
  if (handle.includes("s")) {
    height = Math.max(minH, start.height + dy);
  }
  if (handle.includes("n")) {
    height = Math.max(minH, start.height - dy);
    // Keep the bottom edge anchored when hitting min height.
    y = start.y + start.height - height;
  }

  return { x, y, width, height };
}

export default function PreviewTextOverlay({
  layers,
  onLayersChange,
  interactive = true,
  activeLayerId = null,
  onActiveLayerChange,
  pageIndex = 0,
  backgroundSrc = null,
  showEmptyGuideBoxes = false,
  hideGuideLabels = false,
  editOnSingleClick = false,
  viewScale = 1,
}: PreviewTextOverlayProps) {
  const { t } = useI18n();
  const cs = t.canvasStudio;
  const hostRef = useRef<HTMLDivElement>(null);
  const guideRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const layersRef = useRef(layers);
  const onLayersChangeRef = useRef(onLayersChange);
  const [size, setSize] = useState({ w: 1, h: 1 });
  const [snapGuides, setSnapGuides] = useState<SnapGuides>({
    vertical: [],
    horizontal: [],
  });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pointerActive, setPointerActive] = useState(false);
  const [liveBox, setLiveBox] = useState<{
    id: string;
    box: { x: number; y: number; width: number; height: number };
  } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  layersRef.current = layers;
  onLayersChangeRef.current = onLayersChange;

  const measureStage = () => {
    const el = hostRef.current;
    // offsetWidth/Height ignore CSS transforms — required when stage world uses scale().
    return {
      w: Math.max(1, el?.offsetWidth || size.w),
      h: Math.max(1, el?.offsetHeight || size.h),
    };
  };

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const apply = (width: number, height: number) => {
      setSize({ w: Math.max(1, width), h: Math.max(1, height) });
    };
    apply(el.offsetWidth, el.offsetHeight);
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      apply(entry.contentRect.width, entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = guideRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = size.w;
    canvas.height = size.h;
    ctx.clearRect(0, 0, size.w, size.h);
    if (dragging) drawSnapGuides(ctx, snapGuides, size.w, size.h);
  }, [size, snapGuides, dragging]);

  const scale = canvasTextScale(size.w, size.h);
  const snapPx = Math.max(SNAP_THRESHOLD_PX, Math.min(size.w, size.h) * 0.025);

  const getBoxes = useCallback(() => {
    return layersRef.current.map((layer) => ({
      id: layer.id,
      box:
        dragRef.current?.layerId === layer.id
          ? dragRef.current.liveBox
          : layerToBox(layer, size.w, size.h),
    }));
  }, [size.w, size.h]);

  const commitBox = useCallback(
    (
      layerId: string,
      box: { x: number; y: number; width: number; height: number },
      mode: DragKind,
      startBox: { width: number; height: number },
      stageW: number,
      stageH: number
    ) => {
      const w = Math.max(1, stageW);
      const h = Math.max(1, stageH);
      onLayersChange(
        layersRef.current.map((layer) => {
          if (layer.id !== layerId) return layer;
          const clamped = clampBoxAllowOverflow(box, w, h);
          return {
            ...layer,
            ...boxToLayerPatch(layer, clamped, w, h, mode, startBox),
          };
        })
      );
    },
    [onLayersChange]
  );

  const handlePointerDown = (
    e: ReactPointerEvent<HTMLElement>,
    layerId: string,
    kind: DragKind,
    handle?: ResizeHandle
  ) => {
    if (!interactive || (e.button !== 0 && e.pointerType === "mouse")) return;
    if (editingId === layerId && kind === "move") return;
    e.stopPropagation();
    if (kind === "resize") e.preventDefault();
    const layer = layersRef.current.find((l) => l.id === layerId);
    if (!layer) return;
    onActiveLayerChange?.(layerId);
    const stage = measureStage();
    const box = layerToBox(layer, stage.w, stage.h);
    dragRef.current = {
      kind,
      handle,
      layerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startBox: box,
      liveBox: box,
      pointerType: e.pointerType || "mouse",
      stageW: stage.w,
      stageH: stage.h,
    };
    setLiveBox({ id: layerId, box });
    setPointerActive(true);
    if (kind === "resize") setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  useEffect(() => {
    if (!pointerActive) return;

    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const inv = 1 / Math.max(0.001, viewScale);
      const screenDx = e.clientX - drag.startClientX;
      const screenDy = e.clientY - drag.startClientY;
      const dx = screenDx * inv;
      const dy = screenDy * inv;
      const dist = Math.hypot(screenDx, screenDy);

      if (drag.kind === "move" && !dragging && dist < DRAG_THRESHOLD_PX) {
        return;
      }
      if (drag.kind === "move" && !dragging) {
        setDragging(true);
      }

      let nextBox = { ...drag.startBox };

      if (drag.kind === "move") {
        nextBox = {
          ...nextBox,
          x: drag.startBox.x + dx,
          y: drag.startBox.y + dy,
        };
      } else if (drag.handle) {
        nextBox = applyResize(drag.startBox, dx, dy, drag.handle);
      }

      if (drag.kind === "move") {
        const anchors = getBoxes().filter((a) => a.id !== drag.layerId);
        const targets = collectSnapTargets(
          drag.stageW,
          drag.stageH,
          anchors,
          drag.layerId
        );
        const { deltaX, deltaY, guides } = snapLayerRect(
          rectFromBox(nextBox),
          targets.vertical,
          targets.horizontal,
          Math.max(
            SNAP_THRESHOLD_PX,
            Math.min(drag.stageW, drag.stageH) * 0.025
          )
        );
        nextBox = {
          ...nextBox,
          x: nextBox.x + deltaX,
          y: nextBox.y + deltaY,
        };
        setSnapGuides(guides);
      } else {
        // Resize follows the pointer 1:1 — no snap, avoids height/width jumps.
        setSnapGuides({ vertical: [], horizontal: [] });
      }
      nextBox = clampBoxAllowOverflow(nextBox, drag.stageW, drag.stageH);
      drag.liveBox = nextBox;
      setLiveBox({ id: drag.layerId, box: nextBox });
    };

    const onUp = () => {
      const drag = dragRef.current;
      if (drag) {
        const dx = drag.liveBox.x - drag.startBox.x;
        const dy = drag.liveBox.y - drag.startBox.y;
        const moved = Math.hypot(dx, dy) > DRAG_THRESHOLD_PX;
        if (!moved && drag.kind === "move") {
          // Single tap: select (already) + enter plain-text inline edit.
          // Panel field is revealed (not focused) so canvas caret stays active.
          setEditingId(drag.layerId);
          revealTextLayerField(drag.layerId);
        } else {
          commitBox(
            drag.layerId,
            drag.liveBox,
            drag.kind,
            drag.startBox,
            drag.stageW,
            drag.stageH
          );
        }
      }
      dragRef.current = null;
      setDragging(false);
      setPointerActive(false);
      setLiveBox(null);
      setSnapGuides({ vertical: [], horizontal: [] });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [pointerActive, dragging, getBoxes, commitBox, viewScale]);

  const handleCopy = async (layer: TextLayer) => {
    try {
      await navigator.clipboard.writeText(layer.text);
    } catch {
      /* ignore */
    }
  };

  const handleAddAfter = (afterIndex: number) => {
    const next = addPageTextLayerAfter(
      layersRef.current,
      pageIndex,
      afterIndex
    );
    onLayersChange(next);
    const added = next[Math.min(next.length - 1, afterIndex + 1)];
    if (added) onActiveLayerChange?.(added.id);
  };

  const handleDelete = (layerId: string) => {
    onLayersChange(removeTextLayer(layersRef.current, layerId));
    if (activeLayerId === layerId) onActiveLayerChange?.(null);
    setEditingId((id) => (id === layerId ? null : id));
    setHoverId((id) => (id === layerId ? null : id));
  };

  useEffect(() => {
    if (!backgroundSrc || !size.w || !size.h || !layers.length || interactive) return;
    let cancelled = false;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.src = backgroundSrc;

    image.onload = () => {
      if (cancelled) return;
      try {
        const sampleCanvas = document.createElement("canvas");
        const sampleW = 96;
        const sampleH = Math.max(96, Math.round((image.naturalHeight / Math.max(1, image.naturalWidth)) * 96));
        sampleCanvas.width = sampleW;
        sampleCanvas.height = sampleH;
        const ctx = sampleCanvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(image, 0, 0, sampleW, sampleH);

        const nextLayers = layersRef.current.map((layer) => {
          if (!layer.text.trim() || layer.layoutLocked) return layer;
          const box = layerToBox(layer, size.w, size.h);
          const sx = Math.max(0, Math.min(sampleW - 1, Math.round(((box.x + box.width / 2) / size.w) * sampleW)));
          const sy = Math.max(0, Math.min(sampleH - 1, Math.round(((box.y + box.height / 2) / size.h) * sampleH)));
          const sw = Math.max(1, Math.min(sampleW - sx, Math.round((box.width / size.w) * sampleW)));
          const sh = Math.max(1, Math.min(sampleH - sy, Math.round((box.height / size.h) * sampleH)));
          const data = ctx.getImageData(sx, sy, sw, sh).data;
          let total = 0;
          let count = 0;
          for (let i = 0; i < data.length; i += 4) {
            total += luminanceFromRgb(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0);
            count += 1;
          }
          const lum = count ? total / count : 0.5;
          const nextColor = lum < 0.32 ? CONTRAST_DARK_COLOR : CONTRAST_LIGHT_COLOR;
          return layer.color === nextColor ? layer : { ...layer, color: nextColor };
        });

        const changed = nextLayers.some((layer, index) => layer.color !== layersRef.current[index]?.color);
        if (changed) onLayersChangeRef.current(nextLayers);
      } catch {
        /* ignore CORS / sampling failures */
      }
    };

    return () => {
      cancelled = true;
    };
  }, [backgroundSrc, interactive, size.h, size.w]);

  if (!layers.length) return null;

  return (
    <div
      ref={hostRef}
      className="pointer-events-none absolute inset-0 z-[2] overflow-visible"
      style={{ transformOrigin: "top left" }}
    >
      <canvas
        ref={guideRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[20]"
      />

      {interactive && activeLayerId ? (
        <div
          role="presentation"
          data-overlay-deselect
          className="pointer-events-auto absolute inset-0 z-[4]"
          onPointerDown={(e) => {
            if (e.target !== e.currentTarget) return;
            // Deco/photo overlays sit above this sheet and own their hits.
            e.stopPropagation();
            onActiveLayerChange?.(null);
            setEditingId(null);
            setHoverId(null);
          }}
        />
      ) : null}

      {layers.map((layer, index) => {
        const measured = layerToBox(layer, size.w, size.h);
        const box = liveBox?.id === layer.id ? liveBox.box : measured;
        const isActive = activeLayerId === layer.id;
        const isHover = hoverId === layer.id;
        const isEditing = editingId === layer.id;
        if (
          !layer.text.trim() &&
          !isActive &&
          !isHover &&
          !isEditing &&
          !showEmptyGuideBoxes
        ) {
          return null;
        }
        const showChrome =
          interactive &&
          (isActive ||
            isHover ||
            isEditing ||
            (showEmptyGuideBoxes && !layer.text.trim()));
        const fontSize = Math.max(
          8,
          Math.round((layer.fontSize || 48) * scale)
        );
        const fontFamily = fontForText(
          layer.fontPreset || "pretendard",
          layer.text
        );
        const field = formFieldFromLayerId(layer.id);
        const alignClass = textAlignClass(layer.align);
        const letterSpacing =
          field === "date" || field === "programs"
            ? 0
            : (layer.letterSpacing ?? 0) * scale;

        return (
          <div
            key={layer.id}
            data-text-layer={layer.id}
            className={`pointer-events-auto absolute z-[5] touch-none select-none ${
              interactive && !isEditing
                ? "cursor-grab active:cursor-grabbing"
                : ""
            } ${isActive ? "z-[6]" : ""}`}
            style={{
              left: box.x,
              top: box.y,
              width: box.width,
              height: box.height,
            }}
            onMouseEnter={() => setHoverId(layer.id)}
            onMouseLeave={() =>
              setHoverId((id) => (id === layer.id ? null : id))
            }
            onPointerDown={(e) => handlePointerDown(e, layer.id, "move")}
            onClick={(e) => {
              e.stopPropagation();
              if (!interactive || !editOnSingleClick || dragging) return;
              onActiveLayerChange?.(layer.id);
              setEditingId(layer.id);
            }}
            onDoubleClick={(e) => {
              if (!interactive || editOnSingleClick) return;
              e.stopPropagation();
              onActiveLayerChange?.(layer.id);
              setEditingId(layer.id);
            }}
          >
            {showChrome ? (
              <div className="absolute -top-3.5 left-0 right-0 z-[8] flex items-center justify-between gap-0.5">
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    title={cs.addPageLayer}
                    aria-label={cs.addPageLayer}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddAfter(index);
                    }}
                    className="inline-flex h-3 w-3 items-center justify-center rounded-[2px] border border-white/20 bg-black/70 text-white/85 shadow-sm hover:bg-black/90"
                  >
                    <Plus className="h-2 w-2" strokeWidth={2.5} />
                  </button>
                  <button
                    type="button"
                    title={cs.copy}
                    aria-label={cs.copy}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleCopy(layer);
                    }}
                    className="inline-flex h-3 w-3 items-center justify-center rounded-[2px] border border-white/20 bg-black/70 text-white/85 shadow-sm hover:bg-black/90"
                  >
                    <ClipboardCopy className="h-2 w-2" strokeWidth={2.2} />
                  </button>
                </div>
                <button
                  type="button"
                  title={cs.delete}
                  aria-label={cs.delete}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(layer.id);
                  }}
                  className="inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-[2px] border border-white/20 bg-black/70 text-white/85 shadow-sm hover:bg-rose-950/80 hover:text-rose-200"
                >
                  <Trash2 className="h-2 w-2" strokeWidth={2.2} />
                </button>
              </div>
            ) : null}

            <div
              className={`relative h-full w-full rounded-[2px] ${
                showChrome
                  ? "bg-violet-500/5 shadow-[0_0_0_1px_#818cf8]"
                  : "bg-transparent"
              }`}
              style={
                showChrome
                  ? { outline: "1px dashed #6366f1", outlineOffset: 0 }
                  : undefined
              }
            >
              {isEditing ? (
                <textarea
                  autoFocus
                  value={toPlainLayerListText(layer.text)}
                  onBlur={() => {
                    setEditingId(null);
                    if (field) {
                      const formatted = formatFormFieldText(field, layer.text);
                      if (formatted !== layer.text) {
                        onLayersChange(
                          layersRef.current.map((l) =>
                            l.id === layer.id ? { ...l, text: formatted } : l
                          )
                        );
                      }
                    }
                  }}
                  onChange={(e) => {
                    const text = toPlainLayerListText(
                      stripLayerPlaceholderPrefix(e.target.value)
                    );
                    onLayersChange(
                      layersRef.current.map((l) =>
                        l.id === layer.id ? { ...l, text } : l
                      )
                    );
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className={`canvas-inline-text-edit h-full w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none ${alignClass}`}
                  style={{
                    color: colorPresetFill(layer.color),
                    fontFamily,
                    fontSize,
                    fontWeight: layer.fontWeight ?? 700,
                    textAlign: layer.align || "center",
                    lineHeight: layer.lineHeight ?? 1.25,
                    letterSpacing,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                    boxSizing: "border-box",
                  }}
                />
              ) : (
                <>
                  <LayerTextCanvas
                    layer={layer}
                    width={box.width}
                    height={box.height}
                    scale={scale}
                  />
                  {showEmptyGuideBoxes &&
                  !hideGuideLabels &&
                  !layer.text.trim() &&
                  !isEditing ? (
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center px-2 text-center text-[11px] font-medium text-white/35">
                      {PAGE_ZONE_LABELS[layerZone(layer)]}
                    </span>
                  ) : null}
                </>
              )}

              {showChrome
                ? HANDLES.map((h) => (
                    <span
                      key={h.id}
                      role="presentation"
                      aria-hidden
                      onPointerDown={(e) =>
                        handlePointerDown(e, layer.id, "resize", h.id)
                      }
                      className={`absolute z-[9] h-1 w-1 touch-none rounded-full border border-indigo-400/90 bg-white/95 shadow-sm pointer-coarse:h-1.5 pointer-coarse:w-1.5 ${h.className}`}
                      style={{ cursor: h.cursor }}
                    />
                  ))
                : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
