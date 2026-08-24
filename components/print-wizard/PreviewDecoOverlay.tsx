"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { RotateCw, Trash2 } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import DecoShapeSvg from "@/components/print-wizard/DecoShapeSvg";
import {
  boxToDeco,
  catalogItemForLayer,
  clampDecoBoxToStage,
  decoToBox,
  isSymbolLayer,
  type PrintDecoBox,
} from "@/lib/printWizardDecoLayers";
import type { PrintDecoLayer } from "@/lib/printWizardTypes";

type ResizeHandle = "nw" | "ne" | "se" | "sw" | "n" | "e" | "s" | "w";
type ResizeMode = "free" | "aspect" | "line-x" | "line-y";

type DragKind = "move" | "resize" | "rotate";

type DragState = {
  kind: DragKind;
  handle?: ResizeHandle;
  layerId: string;
  startClientX: number;
  startClientY: number;
  startBox: PrintDecoBox;
  liveBox: PrintDecoBox;
  aspect: number;
  resizeMode: ResizeMode;
  stageW: number;
  stageH: number;
  startRotation: number;
  liveRotation: number;
  centerClientX: number;
  centerClientY: number;
  startPointerAngle: number;
};

const DRAG_THRESHOLD_PX = 4;
const MIN_BOX = 12;

const CORNERS: Array<{
  id: ResizeHandle;
  className: string;
  cursor: string;
}> = [
  { id: "nw", className: "left-0 top-0 -translate-x-1/2 -translate-y-1/2", cursor: "nwse-resize" },
  { id: "ne", className: "right-0 top-0 translate-x-1/2 -translate-y-1/2", cursor: "nesw-resize" },
  { id: "se", className: "bottom-0 right-0 translate-x-1/2 translate-y-1/2", cursor: "nwse-resize" },
  { id: "sw", className: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2", cursor: "nesw-resize" },
];

const LINE_X_HANDLES: Array<{
  id: ResizeHandle;
  className: string;
  cursor: string;
}> = [
  { id: "w", className: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2", cursor: "ew-resize" },
  { id: "e", className: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2", cursor: "ew-resize" },
];

const LINE_Y_HANDLES: Array<{
  id: ResizeHandle;
  className: string;
  cursor: string;
}> = [
  { id: "n", className: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2", cursor: "ns-resize" },
  { id: "s", className: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2", cursor: "ns-resize" },
];

function normalizeDegrees(value: number): number {
  let next = value % 360;
  if (next > 180) next -= 360;
  if (next <= -180) next += 360;
  return next;
}

function isCornerHandle(handle: ResizeHandle): handle is "nw" | "ne" | "se" | "sw" {
  return handle === "nw" || handle === "ne" || handle === "se" || handle === "sw";
}

function applyFreeCornerResize(
  start: PrintDecoBox,
  dx: number,
  dy: number,
  handle: ResizeHandle
): PrintDecoBox {
  let { x, y, width, height } = start;

  if (handle === "se") {
    width = Math.max(MIN_BOX, start.width + dx);
    height = Math.max(MIN_BOX, start.height + dy);
  } else if (handle === "sw") {
    width = Math.max(MIN_BOX, start.width - dx);
    height = Math.max(MIN_BOX, start.height + dy);
    x = start.x + (start.width - width);
  } else if (handle === "ne") {
    width = Math.max(MIN_BOX, start.width + dx);
    height = Math.max(MIN_BOX, start.height - dy);
    y = start.y + (start.height - height);
  } else if (handle === "nw") {
    width = Math.max(MIN_BOX, start.width - dx);
    height = Math.max(MIN_BOX, start.height - dy);
    x = start.x + (start.width - width);
    y = start.y + (start.height - height);
  }

  return { x, y, width, height };
}

function applyUniformCornerResize(
  start: PrintDecoBox,
  dx: number,
  dy: number,
  handle: ResizeHandle,
  aspect: number
): PrintDecoBox {
  if (!isCornerHandle(handle)) return start;

  const ratio = Math.max(0.05, aspect);
  const growX = handle === "se" || handle === "ne" ? dx : -dx;
  const growY = handle === "se" || handle === "sw" ? dy : -dy;
  const dominant = Math.abs(growX) >= Math.abs(growY) ? growX : growY;

  let width = Math.max(MIN_BOX, start.width + dominant);
  let height = Math.max(MIN_BOX, width / ratio);
  if (height < MIN_BOX) {
    height = MIN_BOX;
    width = height * ratio;
  }

  let x = start.x;
  let y = start.y;
  if (handle === "nw" || handle === "sw") {
    x = start.x + (start.width - width);
  }
  if (handle === "nw" || handle === "ne") {
    y = start.y + (start.height - height);
  }

  return { x, y, width, height };
}

function applyLinearResize(
  start: PrintDecoBox,
  dx: number,
  dy: number,
  handle: ResizeHandle,
  mode: ResizeMode
): PrintDecoBox {
  if (mode === "line-x") {
    if (handle === "e") {
      return {
        ...start,
        width: Math.max(MIN_BOX, start.width + dx),
        height: start.height,
      };
    }
    if (handle === "w") {
      const width = Math.max(MIN_BOX, start.width - dx);
      return {
        ...start,
        x: start.x + (start.width - width),
        width,
        height: start.height,
      };
    }
    return start;
  }

  if (mode === "line-y") {
    if (handle === "s") {
      return {
        ...start,
        width: start.width,
        height: Math.max(MIN_BOX, start.height + dy),
      };
    }
    if (handle === "n") {
      const height = Math.max(MIN_BOX, start.height - dy);
      return {
        ...start,
        y: start.y + (start.height - height),
        width: start.width,
        height,
      };
    }
    return start;
  }

  return start;
}

function applyResize(
  start: PrintDecoBox,
  dx: number,
  dy: number,
  handle: ResizeHandle,
  mode: ResizeMode,
  aspect: number
): PrintDecoBox {
  if (mode === "line-x" || mode === "line-y") {
    return applyLinearResize(start, dx, dy, handle, mode);
  }
  if (mode === "aspect") {
    return applyUniformCornerResize(start, dx, dy, handle, aspect);
  }
  return applyFreeCornerResize(start, dx, dy, handle);
}

function resolveResizeMode(layer: PrintDecoLayer): ResizeMode {
  if (isSymbolLayer(layer)) return "aspect";
  const catalog = catalogItemForLayer(layer);
  return catalog?.resizeMode ?? "free";
}

function handlesForResizeMode(mode: ResizeMode) {
  if (mode === "line-x") return LINE_X_HANDLES;
  if (mode === "line-y") return LINE_Y_HANDLES;
  return CORNERS;
}

function boxChanged(a: PrintDecoBox, b: PrintDecoBox): boolean {
  return (
    a.x !== b.x ||
    a.y !== b.y ||
    a.width !== b.width ||
    a.height !== b.height
  );
}

export type PreviewDecoOverlayProps = {
  layers: PrintDecoLayer[];
  onLayersChange: (layers: PrintDecoLayer[]) => void;
  interactive?: boolean;
  activeLayerId?: string | null;
  onActiveLayerChange?: (id: string | null) => void;
};

export default function PreviewDecoOverlay({
  layers,
  onLayersChange,
  interactive = true,
  activeLayerId = null,
  onActiveLayerChange,
}: PreviewDecoOverlayProps) {
  const { t } = useI18n();
  const cs = t.canvasStudio;
  const hostRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const draggingRef = useRef(false);
  const layersRef = useRef(layers);
  const [size, setSize] = useState({ w: 1, h: 1 });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pointerActive, setPointerActive] = useState(false);
  const [liveBox, setLiveBox] = useState<{ id: string; box: PrintDecoBox } | null>(
    null
  );
  const [liveRotation, setLiveRotation] = useState<{
    id: string;
    rotation: number;
  } | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  layersRef.current = layers;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const measureStage = () => {
    const rect = hostRef.current?.getBoundingClientRect();
    return {
      w: Math.max(1, rect?.width ?? size.w),
      h: Math.max(1, rect?.height ?? size.h),
    };
  };

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const apply = () => {
      const { width, height } = el.getBoundingClientRect();
      setSize({ w: Math.max(1, width), h: Math.max(1, height) });
    };
    apply();
    const ro = new ResizeObserver(() => apply());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const commitLayer = useCallback(
    (
      layerId: string,
      box: PrintDecoBox,
      stageW: number,
      stageH: number,
      rotation?: number
    ) => {
      const w = Math.max(1, stageW);
      const h = Math.max(1, stageH);
      onLayersChange(
        layersRef.current.map((layer) => {
          if (layer.id !== layerId) return layer;
          return {
            ...layer,
            ...boxToDeco(box, w, h),
            ...(rotation !== undefined ? { rotation: normalizeDegrees(rotation) } : {}),
          };
        })
      );
    },
    [onLayersChange]
  );

  const handleDelete = (layerId: string) => {
    onLayersChange(layersRef.current.filter((layer) => layer.id !== layerId));
    if (activeLayerId === layerId) onActiveLayerChange?.(null);
    setHoverId((id) => (id === layerId ? null : id));
  };

  const handlePointerDown = (
    e: ReactPointerEvent<HTMLElement>,
    layerId: string,
    kind: DragKind,
    handle?: ResizeHandle
  ) => {
    if (!interactive || (e.button !== 0 && e.pointerType === "mouse")) return;
    e.stopPropagation();
    if (kind === "resize" || kind === "rotate") e.preventDefault();
    const layer = layersRef.current.find((l) => l.id === layerId);
    if (!layer) return;
    const resizeMode = resolveResizeMode(layer);
    onActiveLayerChange?.(layerId);
    const stage = measureStage();
    const box = decoToBox(layer, stage.w, stage.h);
    const hostRect = hostRef.current?.getBoundingClientRect();
    const centerClientX = (hostRect?.left ?? 0) + box.x + box.width / 2;
    const centerClientY = (hostRect?.top ?? 0) + box.y + box.height / 2;
    const startRotation = layer.rotation ?? 0;
    dragRef.current = {
      kind,
      handle,
      layerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startBox: box,
      liveBox: box,
      aspect: box.width / Math.max(1, box.height),
      resizeMode,
      stageW: stage.w,
      stageH: stage.h,
      startRotation,
      liveRotation: startRotation,
      centerClientX,
      centerClientY,
      startPointerAngle: Math.atan2(
        e.clientY - centerClientY,
        e.clientX - centerClientX
      ),
    };
    draggingRef.current = kind !== "move";
    setLiveBox({ id: layerId, box });
    setLiveRotation({ id: layerId, rotation: startRotation });
    setPointerActive(true);
    if (kind === "resize" || kind === "rotate") setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  useEffect(() => {
    if (!pointerActive) return;

    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startClientX;
      const dy = e.clientY - drag.startClientY;
      const dist = Math.hypot(dx, dy);
      if (drag.kind === "move" && !draggingRef.current && dist < DRAG_THRESHOLD_PX) {
        return;
      }
      if (drag.kind === "move" && !draggingRef.current) {
        draggingRef.current = true;
        setDragging(true);
      }

      if (drag.kind === "rotate") {
        const angle = Math.atan2(
          e.clientY - drag.centerClientY,
          e.clientX - drag.centerClientX
        );
        const deltaDeg =
          ((angle - drag.startPointerAngle) * 180) / Math.PI;
        const nextRotation = normalizeDegrees(drag.startRotation + deltaDeg);
        drag.liveRotation = nextRotation;
        setLiveRotation({ id: drag.layerId, rotation: nextRotation });
        return;
      }

      let nextBox: PrintDecoBox =
        drag.kind === "move"
          ? {
              ...drag.startBox,
              x: drag.startBox.x + dx,
              y: drag.startBox.y + dy,
            }
          : drag.handle
            ? applyResize(
                drag.startBox,
                dx,
                dy,
                drag.handle,
                drag.resizeMode,
                drag.aspect
              )
            : drag.startBox;

      nextBox = clampDecoBoxToStage(nextBox, drag.stageW, drag.stageH);
      drag.liveBox = nextBox;
      setLiveBox({ id: drag.layerId, box: nextBox });
    };

    const onUp = () => {
      const drag = dragRef.current;
      if (drag) {
        if (drag.kind === "rotate") {
          commitLayer(
            drag.layerId,
            drag.liveBox,
            drag.stageW,
            drag.stageH,
            drag.liveRotation
          );
        } else if (boxChanged(drag.startBox, drag.liveBox)) {
          commitLayer(
            drag.layerId,
            drag.liveBox,
            drag.stageW,
            drag.stageH
          );
        }
      }
      dragRef.current = null;
      draggingRef.current = false;
      setDragging(false);
      setPointerActive(false);
      setLiveBox(null);
      setLiveRotation(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [pointerActive, commitLayer]);

  if (!layers.length) return null;
  if (interactive && !isMounted) return null;

  return (
    <div
      ref={hostRef}
      className="pointer-events-none absolute inset-0 z-[2] overflow-visible"
      style={{ transformOrigin: "top left" }}
    >
      {layers.map((layer) => {
        const catalog = catalogItemForLayer(layer);
        const symbol = isSymbolLayer(layer) ? layer.symbol : null;
        const measured = decoToBox(layer, size.w, size.h);
        const box = liveBox?.id === layer.id ? liveBox.box : measured;
        const rotation =
          liveRotation?.id === layer.id
            ? liveRotation.rotation
            : (layer.rotation ?? 0);
        const isActive = activeLayerId === layer.id;
        const isHover = hoverId === layer.id;
        const showChrome = interactive && (isActive || isHover || dragging);
        const resizeMode = resolveResizeMode(layer);
        const handles = handlesForResizeMode(resizeMode);
        const symbolSize = Math.max(
          12,
          Math.min(box.width, box.height) * 0.72
        );

        if (!catalog && !symbol) return null;

        return (
          <div
            key={layer.id}
            data-deco-layer={layer.id}
            className={`pointer-events-auto absolute z-[2] touch-none select-none ${
              interactive ? "cursor-grab active:cursor-grabbing" : ""
            } ${isActive ? "z-[3]" : ""}`}
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
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="h-full w-full"
              style={{
                transform: `rotate(${rotation}deg)`,
                transformOrigin: "center center",
              }}
            >
              {symbol ? (
                <span
                  className="font-emoji flex h-full w-full items-center justify-center leading-none text-black drop-shadow-[0_1px_2px_rgba(255,255,255,0.65)]"
                  style={{ fontSize: symbolSize }}
                >
                  {symbol}
                </span>
              ) : catalog ? (
                <DecoShapeSvg category={catalog.category} variant={catalog.variant} />
              ) : null}
            </div>
            {showChrome ? (
              <div className="absolute -top-5 left-0 right-0 z-[8] flex items-center justify-end gap-0.5">
                <button
                  type="button"
                  title={cs.delete}
                  aria-label={cs.delete}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(layer.id);
                  }}
                  className="inline-flex h-4 w-4 items-center justify-center rounded-[3px] border border-white/25 bg-black/80 text-white/90 shadow-sm hover:bg-rose-950 hover:text-rose-200"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </div>
            ) : null}
            {showChrome ? (
              <div
                className="pointer-events-none absolute inset-0 rounded-[3px] bg-red-500/12"
                style={{ outline: "2px dashed #ef4444", outlineOffset: 0 }}
              />
            ) : null}
            {showChrome ? (
              <span
                role="presentation"
                aria-hidden
                title="회전"
                onPointerDown={(e) => handlePointerDown(e, layer.id, "rotate")}
                className="absolute left-1/2 top-0 z-[9] flex h-3.5 w-3.5 -translate-x-1/2 -translate-y-[calc(100%+4px)] touch-none items-center justify-center rounded-full border-2 border-red-500 bg-white text-red-600 shadow pointer-events-auto pointer-coarse:h-4 pointer-coarse:w-4"
                style={{ cursor: "grab" }}
              >
                <RotateCw className="h-2 w-2" />
              </span>
            ) : null}
            {showChrome
              ? handles.map((h) => (
                  <span
                    key={h.id}
                    role="presentation"
                    aria-hidden
                    onPointerDown={(e) =>
                      handlePointerDown(e, layer.id, "resize", h.id)
                    }
                    className={`absolute z-[9] h-2 w-2 touch-none rounded-[2px] border-2 border-red-500 bg-white shadow pointer-events-auto pointer-coarse:h-2.5 pointer-coarse:w-2.5 ${h.className}`}
                    style={{ cursor: h.cursor }}
                  />
                ))
              : null}
          </div>
        );
      })}
    </div>
  );
}
