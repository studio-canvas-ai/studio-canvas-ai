"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useI18n } from "@/components/I18nProvider";
import { Trash2 } from "lucide-react";
import {
  boxToPhoto,
  clampPhotoBoxToStage,
  photoToBox,
  type PrintPhotoBox,
  type PrintPhotoLayer,
} from "@/lib/printWizardPhotoLayers";

type CornerHandle = "nw" | "ne" | "se" | "sw";

type DragKind = "move" | "resize";

type DragState = {
  kind: DragKind;
  handle?: CornerHandle;
  layerId: string;
  startClientX: number;
  startClientY: number;
  startBox: PrintPhotoBox;
  liveBox: PrintPhotoBox;
  aspect: number;
  stageW: number;
  stageH: number;
};

const DRAG_THRESHOLD_PX = 4;
const MIN_BOX = 24;

const CORNERS: Array<{
  id: CornerHandle;
  className: string;
  cursor: string;
}> = [
  { id: "nw", className: "left-0 top-0 -translate-x-1/2 -translate-y-1/2", cursor: "nwse-resize" },
  { id: "ne", className: "right-0 top-0 translate-x-1/2 -translate-y-1/2", cursor: "nesw-resize" },
  { id: "se", className: "bottom-0 right-0 translate-x-1/2 translate-y-1/2", cursor: "nwse-resize" },
  { id: "sw", className: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2", cursor: "nesw-resize" },
];

function applyCornerResize(
  start: PrintPhotoBox,
  dx: number,
  dy: number,
  handle: CornerHandle,
  aspect: number
): PrintPhotoBox {
  const ratio = Math.max(0.05, aspect);
  let width = start.width;
  let height = start.height;
  let x = start.x;
  let y = start.y;

  if (handle === "se" || handle === "ne") {
    width = start.width + dx;
  } else {
    width = start.width - dx;
  }
  width = Math.max(MIN_BOX, width);
  height = width / ratio;
  if (height < MIN_BOX) {
    height = MIN_BOX;
    width = height * ratio;
  }

  if (handle === "nw" || handle === "sw") {
    x = start.x + (start.width - width);
  }
  if (handle === "nw" || handle === "ne") {
    y = start.y + (start.height - height);
  }
  if (handle === "se") {
    x = start.x;
    y = start.y;
  }
  if (handle === "sw") {
    y = start.y;
  }
  if (handle === "ne") {
    x = start.x;
  }

  return { x, y, width, height };
}

export type PreviewPhotoOverlayProps = {
  layers: PrintPhotoLayer[];
  onLayersChange: (layers: PrintPhotoLayer[]) => void;
  interactive?: boolean;
  activeLayerId?: string | null;
  onActiveLayerChange?: (id: string | null) => void;
  /** Ancestor CSS scale — pointer deltas are divided by this. */
  viewScale?: number;
  /** Paint-only layer (no hit targets) — pair with hitTestOnly overlay above text. */
  displayOnly?: boolean;
  /** Invisible pixels; keeps selection chrome and drag/resize hits above text. */
  hitTestOnly?: boolean;
};

export default function PreviewPhotoOverlay({
  layers,
  onLayersChange,
  interactive = true,
  activeLayerId = null,
  onActiveLayerChange,
  viewScale = 1,
  displayOnly = false,
  hitTestOnly = false,
}: PreviewPhotoOverlayProps) {
  const { t } = useI18n();
  const cs = t.canvasStudio;
  const hostRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const draggingRef = useRef(false);
  const capturePointerIdRef = useRef<number | null>(null);
  const layersRef = useRef(layers);
  const [size, setSize] = useState({ w: 1, h: 1 });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pointerActive, setPointerActive] = useState(false);
  const [liveBox, setLiveBox] = useState<{
    id: string;
    box: PrintPhotoBox;
  } | null>(null);

  layersRef.current = layers;

  const measureStage = () => {
    const el = hostRef.current;
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

  const commitBox = useCallback(
    (layerId: string, box: PrintPhotoBox, stageW: number, stageH: number) => {
      const w = Math.max(1, stageW);
      const h = Math.max(1, stageH);
      onLayersChange(
        layersRef.current.map((layer) => {
          if (layer.id !== layerId) return layer;
          return { ...layer, ...boxToPhoto(box, w, h) };
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
    handle?: CornerHandle
  ) => {
    if (!interactive || (e.button !== 0 && e.pointerType === "mouse")) return;
    e.stopPropagation();
    if (kind === "resize") e.preventDefault();
    const layer = layersRef.current.find((l) => l.id === layerId);
    if (!layer) return;
    onActiveLayerChange?.(layerId);
    const stage = measureStage();
    const box = photoToBox(layer, stage.w, stage.h);
    dragRef.current = {
      kind,
      handle,
      layerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startBox: box,
      liveBox: box,
      aspect: box.width / Math.max(1, box.height),
      stageW: stage.w,
      stageH: stage.h,
    };
    setLiveBox({ id: layerId, box });
    draggingRef.current = kind !== "move";
    setPointerActive(true);
    if (kind === "resize") setDragging(true);
    capturePointerIdRef.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    hostRef.current?.setPointerCapture?.(e.pointerId);
  };

  const endDrag = useCallback(
    (pointerId?: number) => {
      const drag = dragRef.current;
      if (drag) {
        const moved =
          drag.kind === "resize" ||
          Math.hypot(
            drag.liveBox.x - drag.startBox.x,
            drag.liveBox.y - drag.startBox.y
          ) > DRAG_THRESHOLD_PX;
        if (moved) {
          commitBox(drag.layerId, drag.liveBox, drag.stageW, drag.stageH);
        }
      }
      dragRef.current = null;
      draggingRef.current = false;
      setDragging(false);
      setPointerActive(false);
      setLiveBox(null);
      const pid = pointerId ?? capturePointerIdRef.current;
      if (pid != null) {
        try {
          hostRef.current?.releasePointerCapture?.(pid);
        } catch {
          /* capture may already be released */
        }
      }
      capturePointerIdRef.current = null;
    },
    [commitBox]
  );

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
      if (drag.kind === "move" && !draggingRef.current && dist < DRAG_THRESHOLD_PX) {
        return;
      }
      if (drag.kind === "move" && !draggingRef.current) {
        draggingRef.current = true;
        setDragging(true);
      }

      let nextBox: PrintPhotoBox =
        drag.kind === "move"
          ? {
              ...drag.startBox,
              x: drag.startBox.x + dx,
              y: drag.startBox.y + dy,
            }
          : drag.handle
            ? applyCornerResize(
                drag.startBox,
                dx,
                dy,
                drag.handle,
                drag.aspect
              )
            : drag.startBox;

      nextBox = clampPhotoBoxToStage(nextBox, drag.stageW, drag.stageH);
      drag.liveBox = nextBox;
      setLiveBox({ id: drag.layerId, box: nextBox });
    };

    const onUp = (e: PointerEvent) => {
      endDrag(e.pointerId);
    };

    const onLostCapture = (e: PointerEvent) => {
      if (dragRef.current) endDrag(e.pointerId);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    const host = hostRef.current;
    host?.addEventListener("lostpointercapture", onLostCapture);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      host?.removeEventListener("lostpointercapture", onLostCapture);
    };
  }, [pointerActive, endDrag, viewScale]);

  if (!layers.length) return null;

  return (
    <div
      ref={hostRef}
      className="pointer-events-none absolute inset-0 z-[1] overflow-visible"
      style={{ transformOrigin: "top left" }}
    >
      {layers.map((layer) => {
        const measured = photoToBox(layer, size.w, size.h);
        const box = liveBox?.id === layer.id ? liveBox.box : measured;
        const isActive = activeLayerId === layer.id;
        const isHover = hoverId === layer.id;
        const showChrome =
          interactive && !displayOnly && (isActive || isHover || dragging);
        const layerPointerEvents =
          displayOnly || !interactive ? "pointer-events-none" : "pointer-events-auto";

        return (
          <div
            key={layer.id}
            data-photo-layer={layer.id}
            className={`${layerPointerEvents} absolute z-[1] touch-none select-none ${
              interactive && !displayOnly
                ? "cursor-grab active:cursor-grabbing"
                : ""
            } ${isActive ? "z-[2]" : ""}`}
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
            onPointerDown={(e) => {
              if (displayOnly) return;
              handlePointerDown(e, layer.id, "move");
            }}
            onClick={(e) => {
              if (displayOnly) return;
              e.stopPropagation();
            }}
          >
            <div
              className={`relative flex h-full w-full items-center justify-center overflow-hidden ${
                hitTestOnly ? "invisible" : ""
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={layer.src}
                alt=""
                draggable={false}
                className="pointer-events-none max-h-full max-w-full object-contain"
                style={
                  layer.trim
                    ? {
                        /* Keep intrinsic ratio; trim only crops via object-position approx */
                        objectFit: "contain",
                        objectPosition: `${
                          ((layer.trim.x + layer.trim.w / 2) * 100).toFixed(2)
                        }% ${((layer.trim.y + layer.trim.h / 2) * 100).toFixed(2)}%`,
                      }
                    : { objectFit: "contain" }
                }
              />
            </div>
            {interactive && !displayOnly ? (
              <button
                type="button"
                title={cs.delete}
                aria-label={cs.delete}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(layer.id);
                }}
                className="absolute right-0 top-0 z-[8] inline-flex h-5 w-5 items-center justify-center rounded-bl-md bg-black/75 text-white/90 shadow-sm hover:bg-rose-600 hover:text-white"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            ) : null}
            {showChrome ? (
              <div
                className="pointer-events-none absolute inset-0 rounded-[2px] bg-indigo-500/5"
                style={{
                  outline: isActive
                    ? "1.5px dashed #a5b4fc"
                    : "1px dashed #818cf8",
                  outlineOffset: 1,
                  boxShadow: isActive
                    ? "0 0 0 1px rgba(99,102,241,0.35)"
                    : undefined,
                }}
              />
            ) : null}
            {showChrome
              ? CORNERS.map((h) => (
                  <span
                    key={h.id}
                    role="presentation"
                    aria-hidden
                    onPointerDown={(e) =>
                      handlePointerDown(e, layer.id, "resize", h.id)
                    }
                    className={`absolute z-[9] h-1.5 w-1.5 touch-none rounded-[1px] border border-indigo-500 bg-white shadow pointer-events-auto pointer-coarse:h-2.5 pointer-coarse:w-2.5 ${h.className}`}
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
