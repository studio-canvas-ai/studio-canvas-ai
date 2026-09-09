"use client";

import {
  memo,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useI18n } from "@/components/I18nProvider";
import {
  moveCaptionRange,
  patchCaptionRange,
  type ShortsCaptionSegment,
} from "@/lib/shortsCaptions";
import type { ShortsWaveformPeaks } from "@/lib/shortsWaveform";

type DragMode = "move" | "start" | "end";

type DragState = {
  id: string;
  mode: DragMode;
  pointerId: number;
  originX: number;
  startSec: number;
  endSec: number;
};

type Props = {
  captions: ShortsCaptionSegment[];
  activeCaptionId: string | null;
  /** Throttled playhead from parent (caption live styles). Prefer videoRef for the line. */
  currentTime: number;
  durationSec: number;
  peaks: ShortsWaveformPeaks | null;
  onChange: (next: ShortsCaptionSegment[]) => void;
  onSelect: (id: string) => void;
  onSeek: (timeSec: number) => void;
  /** When set, playhead line tracks video via rAF without re-rendering the studio. */
  videoRef?: RefObject<HTMLVideoElement | null>;
  videoKey?: string | null;
  /** Slim chrome for dual-studio — keeps previews dominant. */
  compact?: boolean;
};

function formatSec(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00.0";
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

const LIVE_STYLE_MS = 100;

/**
 * Waveform + draggable caption blocks (0.1s snap) for full-studio timeline.
 * Playhead motion uses a DOM ref + rAF when `videoRef` is provided so peaks /
 * caption blocks are not redrawn every animation frame.
 */
function ShortsCaptionWaveTimeline({
  captions,
  activeCaptionId,
  currentTime,
  durationSec,
  peaks,
  compact = false,
  videoRef,
  videoKey,
  onChange,
  onSelect,
  onSeek,
}: Props) {
  const { t } = useI18n();
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const headerTimeRef = useRef<HTMLParagraphElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [trackW, setTrackW] = useState(0);
  /** Throttled time for caption block “live” styles only. */
  const [liveTime, setLiveTime] = useState(currentTime);

  const duration = Math.max(
    0.1,
    durationSec || peaks?.durationSec || 1,
    ...captions.map((c) => c.endSec),
    currentTime + 0.1,
    liveTime + 0.1
  );
  const durationRef = useRef(duration);
  durationRef.current = duration;

  useEffect(() => {
    setLiveTime(currentTime);
  }, [currentTime]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setTrackW(el.getBoundingClientRect().width);
    });
    ro.observe(el);
    setTrackW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  // Waveform bars only — playhead is a separate DOM layer.
  useEffect(() => {
    const canvas = canvasRef.current;
    const track = trackRef.current;
    if (!canvas || trackW <= 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const h = Math.max(
      28,
      Math.round(track?.clientHeight || (compact ? 44 : 56))
    );
    canvas.width = Math.floor(trackW * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${trackW}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, trackW, h);
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fillRect(0, 0, trackW, h);

    const bars = peaks?.peaks;
    if (bars && bars.length) {
      const barW = trackW / bars.length;
      for (let i = 0; i < bars.length; i++) {
        const amp = Math.max(0.08, bars[i]);
        const bh = amp * (h - 8);
        const x = i * barW;
        const y = (h - bh) / 2;
        ctx.fillStyle = "rgba(52, 211, 153, 0.55)";
        ctx.fillRect(x + 0.5, y, Math.max(1, barW - 1), bh);
      }
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.font = "11px sans-serif";
      ctx.fillText(t.shorts.studioWaveformEmpty, 10, h / 2 + 4);
    }
  }, [peaks, trackW, t.shorts.studioWaveformEmpty, compact]);

  const applyPlayheadUi = (tNow: number) => {
    const dur = durationRef.current;
    const pct = Math.max(0, Math.min(100, (tNow / dur) * 100));
    if (playheadRef.current) {
      playheadRef.current.style.left = `${pct}%`;
    }
    if (headerTimeRef.current) {
      headerTimeRef.current.textContent = `${formatSec(tNow)} / ${formatSec(dur)}`;
    }
  };

  // Smooth playhead from the video element (no parent re-render).
  useEffect(() => {
    const video = videoRef?.current;
    if (!video) {
      applyPlayheadUi(currentTime);
      return;
    }

    let raf = 0;
    let lastLiveBucket = -1;
    const pump = (forceLive = false) => {
      const tNow = video.currentTime || 0;
      applyPlayheadUi(tNow);
      const bucket = Math.floor((tNow * 1000) / LIVE_STYLE_MS);
      if (forceLive || bucket !== lastLiveBucket) {
        lastLiveBucket = bucket;
        setLiveTime(tNow);
      }
    };

    const onSeeked = () => pump(true);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("timeupdate", onSeeked);
    pump(true);

    const tick = () => {
      if (!video.paused && !video.ended) {
        pump(false);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("timeupdate", onSeeked);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- currentTime used only as fallback when no video
  }, [videoRef, videoKey, duration]);

  // Fallback when no videoRef: sync playhead from throttled prop.
  useEffect(() => {
    if (videoRef?.current) return;
    applyPlayheadUi(currentTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime, duration, videoRef]);

  const xToTime = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 0;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * duration;
  };

  const onTrackPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-cap-block]")) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    try {
      videoRef?.current?.pause();
    } catch {
      /* ignore */
    }
    const next = xToTime(e.clientX);
    applyPlayheadUi(next);
    onSeek(next);
  };

  const onTrackPointerMove = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-cap-block]")) return;
    if (!(e.currentTarget as HTMLElement).hasPointerCapture?.(e.pointerId)) {
      return;
    }
    const next = xToTime(e.clientX);
    applyPlayheadUi(next);
    onSeek(next);
  };

  const onTrackPointerUp = (e: React.PointerEvent) => {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    try {
      videoRef?.current?.pause();
    } catch {
      /* ignore */
    }
  };

  const beginDrag = (
    e: React.PointerEvent,
    seg: ShortsCaptionSegment,
    mode: DragMode
  ) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(seg.id);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      id: seg.id,
      mode,
      pointerId: e.pointerId,
      originX: e.clientX,
      startSec: seg.startSec,
      endSec: seg.endSec,
    };
  };

  const onDragMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const dxSec = ((e.clientX - drag.originX) / rect.width) * duration;
    onChange(
      captions.map((c) => {
        if (c.id !== drag.id) return c;
        if (drag.mode === "move") {
          return moveCaptionRange(
            { ...c, startSec: drag.startSec, endSec: drag.endSec },
            dxSec,
            duration
          );
        }
        if (drag.mode === "start") {
          return patchCaptionRange(
            c,
            { startSec: drag.startSec + dxSec, endSec: drag.endSec },
            duration
          );
        }
        return patchCaptionRange(
          c,
          { startSec: drag.startSec, endSec: drag.endSec + dxSec },
          duration
        );
      })
    );
  };

  const endDrag = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className={
        compact
          ? "space-y-0.5 rounded-lg border border-white/10 bg-black/40 px-2 py-1"
          : "space-y-2 rounded-xl border border-white/10 bg-black/40 p-3"
      }
    >
      <div className="flex items-center justify-between gap-2">
        <p
          className={
            compact
              ? "text-[10px] font-semibold text-white/90"
              : "text-xs font-semibold text-white/80"
          }
        >
          {t.shorts.studioWaveformTitle}
        </p>
        <p
          ref={headerTimeRef}
          className="text-[10px] text-white/80 tabular-nums"
        >
          {formatSec(liveTime)} / {formatSec(duration)}
        </p>
      </div>
      {!compact ? (
        <p className="text-[11px] text-white/75">{t.shorts.studioWaveformHint}</p>
      ) : null}

      <div
        ref={trackRef}
        className={`relative w-full touch-none select-none overflow-hidden rounded-lg bg-black/50 ring-1 ring-white/10 ${
          compact ? "h-11 min-h-11" : "h-28"
        }`}
        onPointerDown={onTrackPointerDown}
        onPointerMove={onTrackPointerMove}
        onPointerUp={onTrackPointerUp}
        onPointerCancel={onTrackPointerUp}
      >
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-x-0 top-0" />

        <div
          ref={playheadRef}
          className="pointer-events-none absolute inset-y-0 z-20 w-0.5 -translate-x-1/2 bg-white/85 shadow-[0_0_4px_rgba(0,0,0,0.6)]"
          style={{ left: `${Math.max(0, Math.min(100, (liveTime / duration) * 100))}%` }}
          aria-hidden
        />

        <div
          className={`absolute inset-x-0 bottom-0 ${
            compact ? "top-3.5" : "top-14"
          }`}
        >
          {captions.map((seg, i) => {
            const left = (seg.startSec / duration) * 100;
            const width = Math.max(
              0.8,
              ((seg.endSec - seg.startSec) / duration) * 100
            );
            const active = seg.id === activeCaptionId;
            const live = liveTime >= seg.startSec && liveTime < seg.endSec;
            return (
              <div
                key={seg.id}
                data-cap-block
                className={`absolute top-1 bottom-1 overflow-hidden rounded-md border text-[10px] font-medium ${
                  live
                    ? "border-glow-emerald/70 bg-glow-emerald/25 text-white"
                    : active
                      ? "border-white/40 bg-white/15 text-white"
                      : "border-white/15 bg-white/10 text-white/90"
                }`}
                style={{ left: `${left}%`, width: `${width}%` }}
                onPointerDown={(e) => beginDrag(e, seg, "move")}
                onPointerMove={onDragMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                title={`#${i + 1} ${seg.text}`}
              >
                <button
                  type="button"
                  aria-label="trim-start"
                  className="absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize bg-white/30"
                  onPointerDown={(e) => beginDrag(e, seg, "start")}
                  onPointerMove={onDragMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                />
                <span className="pointer-events-none block truncate px-2.5 py-1.5">
                  {seg.text || `#${i + 1}`}
                </span>
                <button
                  type="button"
                  aria-label="trim-end"
                  className="absolute inset-y-0 right-0 z-10 w-2 cursor-ew-resize bg-white/30"
                  onPointerDown={(e) => beginDrag(e, seg, "end")}
                  onPointerMove={onDragMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default memo(ShortsCaptionWaveTimeline);
