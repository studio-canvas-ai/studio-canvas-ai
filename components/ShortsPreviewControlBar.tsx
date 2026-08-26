"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pause,
  PictureInPicture2,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import {
  SHORTS_CAPTION_ENTRANCE_EFFECTS,
  normalizeCaptionEntranceEffect,
  type ShortsCaptionEntranceEffect,
} from "@/lib/shortsCaptions";

export const SHORTS_PREVIEW_DEFAULT_VOLUME = 0.5;

/** Parent caption-sync sampling rate (avoids full-studio re-render every frame). */
const PLAYHEAD_SAMPLE_MS = 120;

/** After scrubbing a range control, drop focus so Space resumes play/pause. */
function blurRangeControl(e: React.SyntheticEvent<HTMLInputElement>) {
  try {
    e.currentTarget.blur();
  } catch {
    /* ignore */
  }
}

/** Keep preview paused after timeline scrub so Space starts playback. */
function pausePreviewVideo(
  videoRef: React.RefObject<HTMLVideoElement | null>
) {
  const video = videoRef.current;
  if (!video) return;
  try {
    video.pause();
  } catch {
    /* ignore */
  }
}

function blurSelectControl(e: React.SyntheticEvent<HTMLSelectElement>) {
  try {
    e.currentTarget.blur();
  } catch {
    /* ignore */
  }
}

type Props = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Remount sync when src changes */
  videoKey?: string | null;
  /**
   * `stacked` — full-width seek row (matches waveform timeline width in dual studio).
   * `inline` — classic single-row bar (single-screen studio).
   */
  layout?: "inline" | "stacked";
  /** Optional duration hint from parent. */
  duration?: number;
  onSeek?: (timeSec: number) => void;
  /** Throttled playhead samples for caption sync (~8 Hz). Not used for the seek UI. */
  onPlayheadSample?: (timeSec: number) => void;
  /** Dual-studio: compact Scale / PosY beside transport + volume. */
  videoScale?: number;
  videoPosY?: number;
  onVideoScaleChange?: (v: number) => void;
  onVideoPosYChange?: (v: number) => void;
  videoScaleMin?: number;
  videoScaleMax?: number;
  videoScaleStep?: number;
  /** Short labels next to layout sliders (e.g. 크기 / 상하). */
  scaleLabel?: string;
  posYLabel?: string;
  /** How to render the scale readout (default: percent). */
  scaleValueFormat?: "percent" | "px";
  /** Caption entrance effect (beside volume / layout sliders). */
  entranceEffect?: ShortsCaptionEntranceEffect;
  onEntranceEffectChange?: (effect: ShortsCaptionEntranceEffect) => void;
};

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60) % 60;
  const h = Math.floor(sec / 3600);
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

/**
 * External control bar for the 9:16 studio preview — sits below the canvas
 * so native controls never cover bottom text layers.
 *
 * Playhead UI state stays local (rAF) so the parent dual-studio tree does not
 * re-render on every animation frame.
 */
export default function ShortsPreviewControlBar({
  videoRef,
  videoKey,
  layout = "inline",
  duration: controlledDuration,
  onSeek: onSeekProp,
  onPlayheadSample,
  videoScale,
  videoPosY,
  onVideoScaleChange,
  onVideoPosYChange,
  videoScaleMin = 0.5,
  videoScaleMax = 1.5,
  videoScaleStep = 0.01,
  scaleLabel,
  posYLabel,
  scaleValueFormat = "percent",
  entranceEffect,
  onEntranceEffectChange,
}: Props) {
  const { t } = useI18n();
  const scaleLabelText = scaleLabel ?? t.shorts.studioVideoScale;
  const posYLabelText = posYLabel ?? t.shorts.studioVideoPosY;
  const formatScaleValue = (v: number) =>
    scaleValueFormat === "px"
      ? `${Math.round(v)}px`
      : `${Math.round(v * 100)}%`;
  const formatPosYValue = (v: number) => `${Math.round(v * 100)}%`;
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(SHORTS_PREVIEW_DEFAULT_VOLUME);
  const [muted, setMuted] = useState(false);
  const [pipActive, setPipActive] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);
  const lastSampleAtRef = useRef(0);
  const sampleCbRef = useRef(onPlayheadSample);
  sampleCbRef.current = onPlayheadSample;

  const displayDuration =
    typeof controlledDuration === "number" && controlledDuration > 0
      ? controlledDuration
      : duration;

  const emitSample = useCallback((tNow: number, force = false) => {
    const now = performance.now();
    if (!force && now - lastSampleAtRef.current < PLAYHEAD_SAMPLE_MS) return;
    lastSampleAtRef.current = now;
    sampleCbRef.current?.(tNow);
  }, []);

  useEffect(() => {
    const ok =
      typeof document !== "undefined" &&
      document.pictureInPictureEnabled !== false &&
      typeof HTMLVideoElement !== "undefined" &&
      typeof HTMLVideoElement.prototype.requestPictureInPicture === "function";
    setPipSupported(ok);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = SHORTS_PREVIEW_DEFAULT_VOLUME;
    setVolume(video.volume);
    setMuted(video.muted);

    const sync = () => {
      setPlaying(!video.paused && !video.ended);
      const tNow = video.currentTime || 0;
      setCurrent(tNow);
      emitSample(tNow, true);
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      setVolume(video.volume);
      setMuted(video.muted);
    };

    const onTime = () => {
      const tNow = video.currentTime || 0;
      setCurrent(tNow);
      emitSample(tNow);
    };
    const onMeta = () => {
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      sync();
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => {
      setPlaying(false);
      emitSample(video.currentTime || 0, true);
    };
    const onVol = () => {
      setVolume(video.volume);
      setMuted(video.muted);
    };
    const onEnterPip = () => setPipActive(true);
    const onLeavePip = () => setPipActive(false);

    sync();
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("seeked", onTime);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("durationchange", onMeta);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onPause);
    video.addEventListener("volumechange", onVol);
    video.addEventListener("enterpictureinpicture", onEnterPip);
    video.addEventListener("leavepictureinpicture", onLeavePip);

    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("seeked", onTime);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("durationchange", onMeta);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onPause);
      video.removeEventListener("volumechange", onVol);
      video.removeEventListener("enterpictureinpicture", onEnterPip);
      video.removeEventListener("leavepictureinpicture", onLeavePip);
    };
  }, [videoRef, videoKey, emitSample]);

  // Local rAF for smooth seek thumb — does NOT lift state to parent every frame.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playing) return;
    let raf = 0;
    const tick = () => {
      if (!video.paused && !video.ended) {
        const tNow = video.currentTime || 0;
        setCurrent(tNow);
        emitSample(tNow);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [videoRef, videoKey, playing, emitSample]);

  const togglePlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (video.paused || video.ended) {
        await video.play();
      } else {
        video.pause();
      }
    } catch (err) {
      console.warn("[shorts/studio] play failed", err);
    }
  }, [videoRef]);

  const onSeek = useCallback(
    (value: number) => {
      const video = videoRef.current;
      if (!Number.isFinite(value)) return;
      const maxDur =
        displayDuration ||
        (video && Number.isFinite(video.duration) ? video.duration : 0) ||
        0;
      const next = Math.max(0, Math.min(maxDur || value, value));
      if (video) {
        try {
          video.currentTime = next;
        } catch {
          /* ignore */
        }
      }
      setCurrent(next);
      emitSample(next, true);
      onSeekProp?.(next);
    },
    [videoRef, displayDuration, emitSample, onSeekProp]
  );

  const onVolume = useCallback(
    (value: number) => {
      const video = videoRef.current;
      if (!video) return;
      const v = Math.max(0, Math.min(1, value));
      video.volume = v;
      video.muted = v === 0;
      setVolume(v);
      setMuted(video.muted);
    },
    [videoRef]
  );

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    if (!video.muted && video.volume === 0) {
      video.volume = SHORTS_PREVIEW_DEFAULT_VOLUME;
    }
    setMuted(video.muted);
    setVolume(video.volume);
  }, [videoRef]);

  const togglePip = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !pipSupported) return;
    try {
      if (document.pictureInPictureElement === video) {
        await document.exitPictureInPicture();
      } else {
        if (video.paused) {
          try {
            await video.play();
          } catch {
            /* ignore */
          }
        }
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.warn("[shorts/studio] PiP failed", err);
    }
  }, [videoRef, pipSupported]);

  const max = displayDuration > 0 ? displayDuration : 0;
  const seekValue = Math.min(current, max || 0);

  const showLayoutSliders =
    typeof videoScale === "number" &&
    typeof videoPosY === "number" &&
    typeof onVideoScaleChange === "function" &&
    typeof onVideoPosYChange === "function";

  const showEntranceSelect =
    typeof entranceEffect === "string" &&
    typeof onEntranceEffectChange === "function";

  const layoutSliders = showLayoutSliders ? (
    layout === "stacked" ? (
      // Dual studio: single-line, labeled, tight packing.
      <div className="flex shrink-0 flex-nowrap items-center gap-0.5 sm:gap-1">
        <span className="shrink-0 text-[9px] font-semibold text-white/90">
          {scaleLabelText}
        </span>
        <input
          type="range"
          min={videoScaleMin}
          max={videoScaleMax}
          step={videoScaleStep}
          value={videoScale}
          onChange={(e) => onVideoScaleChange(Number(e.target.value))}
          onPointerUp={blurRangeControl}
          onMouseUp={blurRangeControl}
          className="h-1 w-36 shrink-0 cursor-pointer accent-emerald-400 sm:w-44"
          aria-label={scaleLabelText}
          title={`${scaleLabelText} ${formatScaleValue(videoScale)}`}
        />
        <span className="w-8 shrink-0 text-right text-[9px] tabular-nums text-white/90">
          {formatScaleValue(videoScale)}
        </span>
        <span className="ml-0.5 shrink-0 text-[9px] font-semibold text-white/90">
          {posYLabelText}
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={videoPosY}
          onChange={(e) => onVideoPosYChange(Number(e.target.value))}
          onPointerUp={blurRangeControl}
          onMouseUp={blurRangeControl}
          className="h-1 w-36 shrink-0 cursor-pointer accent-emerald-400 sm:w-44"
          aria-label={posYLabelText}
          title={`${posYLabelText} ${formatPosYValue(videoPosY)}`}
        />
        <span className="w-8 shrink-0 text-right text-[9px] tabular-nums text-white/90">
          {formatPosYValue(videoPosY)}
        </span>
      </div>
    ) : (
      <div className="ml-0.5 flex w-[9.75rem] shrink-0 flex-col justify-center gap-0.5 sm:w-[10.5rem]">
        <div className="flex w-full min-w-0 items-center gap-1">
          <span className="w-7 shrink-0 truncate text-[9px] text-white/85">
            {scaleLabelText}
          </span>
          <input
            type="range"
            min={videoScaleMin}
            max={videoScaleMax}
            step={videoScaleStep}
            value={videoScale}
            onChange={(e) => onVideoScaleChange(Number(e.target.value))}
            onPointerUp={blurRangeControl}
            onMouseUp={blurRangeControl}
            className="h-1 min-w-0 flex-1 cursor-pointer accent-emerald-400"
            aria-label={scaleLabelText}
          />
          <span className="w-8 shrink-0 text-right text-[9px] tabular-nums text-white/90">
            {formatScaleValue(videoScale)}
          </span>
        </div>
        <div className="flex w-full min-w-0 items-center gap-1">
          <span className="w-7 shrink-0 truncate text-[9px] text-white/85">
            {posYLabelText}
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={videoPosY}
            onChange={(e) => onVideoPosYChange(Number(e.target.value))}
            onPointerUp={blurRangeControl}
            onMouseUp={blurRangeControl}
            className="h-1 min-w-0 flex-1 cursor-pointer accent-emerald-400"
            aria-label={posYLabelText}
          />
          <span className="w-8 shrink-0 text-right text-[9px] tabular-nums text-white/90">
            {formatPosYValue(videoPosY)}
          </span>
        </div>
      </div>
    )
  ) : null;

  const entranceSelect = showEntranceSelect ? (
    layout === "stacked" ? (
      <select
        value={normalizeCaptionEntranceEffect(entranceEffect)}
        onChange={(e) => {
          const next = normalizeCaptionEntranceEffect(e.target.value);
          onEntranceEffectChange(next);
          blurSelectControl(e);
        }}
        className="h-7 max-w-[7rem] min-w-0 shrink-0 truncate rounded-md border border-white/15 bg-black/55 px-1.5 text-[10px] text-white outline-none ring-glow-emerald/40 focus:ring-1 sm:max-w-[8.5rem]"
        aria-label={t.shorts.captionEntranceLabel}
        title={t.shorts.captionEntranceLabel}
      >
        {SHORTS_CAPTION_ENTRANCE_EFFECTS.map((effect) => (
          <option key={effect} value={effect}>
            {t.shorts.captionEntranceEffects[effect]}
          </option>
        ))}
      </select>
    ) : (
      <label className="ml-0.5 flex min-w-0 max-w-[11.5rem] shrink-0 flex-col gap-0.5 sm:max-w-[13rem]">
        <span className="truncate text-[9px] leading-none text-white/85">
          {t.shorts.captionEntranceLabel}
        </span>
        <select
          value={normalizeCaptionEntranceEffect(entranceEffect)}
          onChange={(e) => {
            const next = normalizeCaptionEntranceEffect(e.target.value);
            onEntranceEffectChange(next);
            blurSelectControl(e);
          }}
          className="h-7 w-full min-w-0 truncate rounded-md border border-white/15 bg-black/55 px-1.5 text-[10px] text-white outline-none ring-glow-emerald/40 focus:ring-1"
          aria-label={t.shorts.captionEntranceLabel}
        >
          {SHORTS_CAPTION_ENTRANCE_EFFECTS.map((effect) => (
            <option key={effect} value={effect}>
              {t.shorts.captionEntranceEffects[effect]}
            </option>
          ))}
        </select>
      </label>
    )
  ) : null;

  const volumeSlider = (
    <input
      type="range"
      min={0}
      max={1}
      step={0.01}
      value={muted ? 0 : volume}
      onChange={(e) => onVolume(Number(e.target.value))}
      onPointerUp={blurRangeControl}
      onMouseUp={blurRangeControl}
      className={
        layout === "stacked"
          ? "h-1 w-36 shrink-0 cursor-pointer accent-emerald-400 sm:w-44"
          : "h-1 w-36 shrink-0 cursor-pointer accent-emerald-400 sm:w-40"
      }
      aria-label={t.shorts.studioVolume}
    />
  );

  const onSeekEnd = useCallback(
    (e: React.SyntheticEvent<HTMLInputElement>) => {
      pausePreviewVideo(videoRef);
      setPlaying(false);
      blurRangeControl(e);
    },
    [videoRef]
  );

  const seekSlider = (
    <input
      type="range"
      min={0}
      max={max || 0}
      step={0.001}
      value={seekValue}
      disabled={!max}
      onChange={(e) => onSeek(Number(e.target.value))}
      onInput={(e) => onSeek(Number((e.target as HTMLInputElement).value))}
      onPointerDown={() => pausePreviewVideo(videoRef)}
      onPointerUp={onSeekEnd}
      onMouseUp={onSeekEnd}
      onTouchEnd={onSeekEnd}
      className={
        layout === "stacked"
          ? "h-1.5 w-full cursor-pointer accent-emerald-400 disabled:opacity-40"
          : "h-1 min-w-0 flex-1 cursor-pointer accent-emerald-400 disabled:opacity-40"
      }
      aria-label={t.shorts.studioTimeline}
    />
  );

  const transport = (
    <>
      <button
        type="button"
        onClick={() => void togglePlay()}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/10 text-white transition hover:bg-white/15"
        aria-label={playing ? t.shorts.studioPause : t.shorts.studioPlay}
      >
        {playing ? (
          <Pause className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <Play className="h-3.5 w-3.5 pl-0.5" aria-hidden />
        )}
      </button>

      {layout === "inline" ? seekSlider : null}

      <span className="shrink-0 text-[10px] tabular-nums text-white/85">
        {formatTime(current)}
        <span className="text-white/90"> / </span>
        {formatTime(displayDuration)}
      </span>

      <button
        type="button"
        onClick={toggleMute}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/5 text-white/80 transition hover:bg-white/10"
        aria-label={muted ? t.shorts.studioUnmute : t.shorts.studioMute}
        aria-pressed={muted}
      >
        {muted || volume === 0 ? (
          <VolumeX className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <Volume2 className="h-3.5 w-3.5" aria-hidden />
        )}
      </button>

      {volumeSlider}
      {layoutSliders}
      {entranceSelect}

      {pipSupported && (
        <button
          type="button"
          onClick={() => void togglePip()}
          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition ${
            pipActive
              ? "border-glow-emerald/50 bg-glow-emerald/15 text-glow-emerald"
              : "border-white/15 bg-white/5 text-white/90 hover:border-white/25 hover:text-white"
          }`}
          aria-pressed={pipActive}
          aria-label={
            pipActive ? t.shorts.studioPipExit : t.shorts.studioPipEnter
          }
          title={pipActive ? t.shorts.studioPipExit : t.shorts.studioPipEnter}
        >
          <PictureInPicture2 className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </>
  );

  if (layout === "stacked") {
    return (
      <div
        className="space-y-1 rounded-lg border border-white/10 bg-black/40 px-1.5 py-1"
        title={t.shorts.studioPreviewAudioHint}
      >
        <div className="flex min-w-0 flex-nowrap items-center gap-0.5 overflow-x-auto sm:gap-1">
          {transport}
        </div>
        <div className="w-full">{seekSlider}</div>
      </div>
    );
  }

  return (
    <div
      className="mt-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-black/40 px-1.5 py-1.5"
      title={t.shorts.studioPreviewAudioHint}
    >
      {transport}
    </div>
  );
}
