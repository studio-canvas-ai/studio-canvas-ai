"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

type ImageComparisonSliderProps = {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel: string;
  afterLabel: string;
  /** Accessible name for the slider control */
  ariaLabel: string;
  className?: string;
  /** Extra classes on the framed media box (e.g. gallery popup polish) */
  frameClassName?: string;
  /** Initial reveal position (0–100, percent of After visible from the left) */
  initialPosition?: number;
  /** Optional badge rendered in the top-left of the frame */
  topBadge?: ReactNode;
  /** Optional status chip in the bottom-right */
  statusChip?: ReactNode;
  /** Idle auto-wiggle (hero). Off for hover popups to avoid jank. */
  idleDemo?: boolean;
  /** Fired when the user starts / stops dragging the divider */
  onDragChange?: (dragging: boolean) => void;
};

/**
 * Classic before/after reveal slider.
 * Dragging left shows more Before; dragging right shows more After.
 */
export default function ImageComparisonSlider({
  beforeSrc,
  afterSrc,
  beforeLabel,
  afterLabel,
  ariaLabel,
  className = "",
  frameClassName = "",
  initialPosition = 52,
  topBadge,
  statusChip,
  idleDemo = true,
  onDragChange,
}: ImageComparisonSliderProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const activePointerRef = useRef<number | null>(null);
  const [position, setPosition] = useState(() =>
    Math.min(90, Math.max(10, initialPosition))
  );
  const [dragging, setDragging] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const labelId = useId();
  const dirRef = useRef(1);

  const updateFromClientX = useCallback((clientX: number) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(92, Math.max(8, next)));
  }, []);

  const stopDragging = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    activePointerRef.current = null;
    setDragging(false);
    onDragChange?.(false);
  }, [onDragChange]);

  const startDragging = useCallback(
    (pointerId: number, clientX: number) => {
      draggingRef.current = true;
      activePointerRef.current = pointerId;
      setHasInteracted(true);
      setDragging(true);
      onDragChange?.(true);
      updateFromClientX(clientX);
    },
    [onDragChange, updateFromClientX]
  );

  // Window-level move/up so drag stays smooth even if the pointer leaves the frame
  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => {
      if (
        activePointerRef.current != null &&
        e.pointerId !== activePointerRef.current
      ) {
        return;
      }
      if (!draggingRef.current) return;
      e.preventDefault();
      updateFromClientX(e.clientX);
    };

    const onUp = (e: PointerEvent) => {
      if (
        activePointerRef.current != null &&
        e.pointerId !== activePointerRef.current
      ) {
        return;
      }
      stopDragging();
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging, stopDragging, updateFromClientX]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      // Only primary button / touch / pen
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
      startDragging(e.pointerId, e.clientX);
    },
    [startDragging]
  );

  // Gentle idle demo until the user interacts once (hero only).
  useEffect(() => {
    if (!idleDemo || hasInteracted || dragging) return;
    const id = window.setInterval(() => {
      setPosition((prev) => {
        const next = prev + dirRef.current * 0.35;
        if (next >= 68) {
          dirRef.current = -1;
          return 68;
        }
        if (next <= 32) {
          dirRef.current = 1;
          return 32;
        }
        return next;
      });
    }, 48);
    return () => window.clearInterval(id);
  }, [idleDemo, hasInteracted, dragging]);

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    const step = e.shiftKey ? 8 : 3;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      setHasInteracted(true);
      setPosition((p) => Math.max(8, p - step));
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      setHasInteracted(true);
      setPosition((p) => Math.min(92, p + step));
    } else if (e.key === "Home") {
      e.preventDefault();
      setHasInteracted(true);
      setPosition(8);
    } else if (e.key === "End") {
      e.preventDefault();
      setHasInteracted(true);
      setPosition(92);
    }
  }, []);

  return (
    <div className={`image-compare ${className}`.trim()}>
      <div
        ref={frameRef}
        className={`image-compare__frame ${dragging ? "is-dragging" : ""} ${frameClassName}`.trim()}
        onPointerDown={onPointerDown}
        role="group"
        aria-labelledby={labelId}
      >
        <span id={labelId} className="image-compare__sr-only">
          {ariaLabel}
        </span>

        {/* After (AI) — full frame base */}
        <img
          src={afterSrc}
          alt=""
          className="image-compare__img image-compare__img--after"
          draggable={false}
        />

        {/* Before (selfie) — clipped from the left up to the handle */}
        <div
          className="image-compare__before-clip"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          <img
            src={beforeSrc}
            alt=""
            className="image-compare__img image-compare__img--before"
            draggable={false}
          />
        </div>

        <div className="image-compare__label image-compare__label--before">
          {beforeLabel}
        </div>
        <div className="image-compare__label image-compare__label--after">
          {afterLabel}
        </div>

        {topBadge ? (
          <div className="image-compare__top-badge">{topBadge}</div>
        ) : null}
        {statusChip ? (
          <div className="image-compare__status">{statusChip}</div>
        ) : null}

        {/* Divider + handle */}
        <div
          className="image-compare__divider"
          style={{ left: `${position}%` }}
          aria-hidden
        >
          <div className="image-compare__handle">
            <span className="image-compare__handle-grip" />
          </div>
        </div>

        {/* Keyboard / AT control — pointer handled by the frame above */}
        <input
          type="range"
          min={8}
          max={92}
          value={Math.round(position)}
          aria-label={ariaLabel}
          className="image-compare__range"
          tabIndex={0}
          onChange={(e) => {
            setHasInteracted(true);
            setPosition(Number(e.target.value));
          }}
          onKeyDown={onKeyDown}
        />
      </div>
    </div>
  );
}
