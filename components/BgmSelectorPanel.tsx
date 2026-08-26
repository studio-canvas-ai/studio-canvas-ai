"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Music2, Pause, Play, Upload } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import {
  BGM_CATEGORIES,
  BGM_LIBRARY,
  bgmCategoryCounts,
  bgmCategoryLabel,
  bgmItemsByCategory,
  resolveBgmUrl,
  type BgmCategory,
} from "@/lib/bgmLibrary";
import { bgmFilenameFromObjectKey } from "@/lib/bgm/buildBgmItems";
import {
  SHORTS_BGM_VOLUME_MAX,
  SHORTS_BGM_VOLUME_MIN,
  clampBgmVolume,
  isShortsBgmAudioFile,
  type ShortsBgmState,
} from "@/lib/shortsBgm";

type Props = {
  value: ShortsBgmState;
  onChange: (next: ShortsBgmState) => void;
};

/**
 * Accordion BGM selector — R2 library + local upload + volume.
 * Preview audio is panel-local; selection syncs to parent shorts studio state.
 * Track lists always come from static per-genre manifests (never R2 re-list).
 */
export default function BgmSelectorPanel({ value, onChange }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<BgmCategory | "all">("all");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const customObjectUrlRef = useRef<string | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const categoryCounts = useMemo(() => bgmCategoryCounts(), []);

  const tracks = useMemo(() => bgmItemsByCategory(category), [category]);

  const stopPreview = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    setPreviewId(null);
  }, []);

  // Scroll to top + stop preview whenever the genre tab changes.
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
    stopPreview();
  }, [category, stopPreview]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "none";
    audioRef.current = audio;
    const onEnded = () => setPreviewId(null);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.pause();
      audioRef.current = null;
      if (customObjectUrlRef.current) {
        URL.revokeObjectURL(customObjectUrlRef.current);
        customObjectUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = clampBgmVolume(value.bgmVolume);
    }
  }, [value.bgmVolume]);

  const selectTrack = useCallback(
    (url: string, name: string) => {
      onChange({
        ...value,
        bgmUrl: url,
        bgmName: name,
      });
      setUploadError(null);
    },
    [onChange, value]
  );

  const clearTrack = useCallback(() => {
    stopPreview();
    if (customObjectUrlRef.current) {
      URL.revokeObjectURL(customObjectUrlRef.current);
      customObjectUrlRef.current = null;
    }
    onChange({
      ...value,
      bgmUrl: null,
      bgmName: "",
    });
  }, [onChange, stopPreview, value]);

  /**
   * Preview play also applies the track as the project BGM so the green
   * selection + export mix always match the last play button pressed.
   */
  const togglePreview = useCallback(
    async (id: string, url: string, name: string) => {
      const audio = audioRef.current;
      if (!audio) return;

      if (previewId === id) {
        stopPreview();
        return;
      }

      onChange({
        ...value,
        bgmUrl: url,
        bgmName: name,
      });
      setUploadError(null);

      try {
        audio.pause();
        audio.src = url;
        audio.volume = clampBgmVolume(value.bgmVolume);
        setPreviewId(id);
        await audio.play();
      } catch (err) {
        console.warn("[shorts/bgm] preview failed", err);
        setPreviewId(null);
        setUploadError(t.shorts.bgmPreviewError);
      }
    },
    [
      previewId,
      stopPreview,
      onChange,
      value,
      t.shorts.bgmPreviewError,
    ]
  );

  const onUpload = useCallback(
    (fileList: FileList | null) => {
      const file = fileList?.[0];
      if (!file) return;
      if (!isShortsBgmAudioFile(file)) {
        setUploadError(t.shorts.bgmUploadTypeError);
        return;
      }
      if (customObjectUrlRef.current) {
        URL.revokeObjectURL(customObjectUrlRef.current);
      }
      const url = URL.createObjectURL(file);
      customObjectUrlRef.current = url;
      const name = file.name.replace(/\.[^.]+$/, "") || file.name;
      void togglePreview(`custom:${url}`, url, name);
    },
    [t.shorts.bgmUploadTypeError, togglePreview]
  );

  const selectedLabel =
    value.bgmName.trim() ||
    (value.bgmUrl ? t.shorts.bgmCustomTrack : t.shorts.bgmNone);

  const volumePct = Math.round(clampBgmVolume(value.bgmVolume) * 100);

  const setVolume = useCallback(
    (raw: number) => {
      onChange({
        ...value,
        bgmVolume: clampBgmVolume(raw),
      });
    },
    [onChange, value]
  );

  /** Shared BGM volume control — top + bottom stay in sync via `value.bgmVolume`. */
  const volumeSlider = (
    <div className="flex items-center gap-2.5">
      <span className="shrink-0 text-[10px] font-semibold text-white/85">
        {t.shorts.bgmVolume}
      </span>
      <input
        type="range"
        min={SHORTS_BGM_VOLUME_MIN}
        max={SHORTS_BGM_VOLUME_MAX}
        step={0.01}
        value={clampBgmVolume(value.bgmVolume)}
        onChange={(e) => setVolume(Number(e.target.value))}
        aria-label={t.shorts.bgmVolume}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={volumePct}
        aria-valuetext={`${volumePct}%`}
        className="min-w-0 flex-1 accent-emerald-400"
      />
      <span
        className="inline-flex w-11 shrink-0 items-center justify-center rounded-md border border-emerald-400/40 bg-emerald-400/15 px-1 py-0.5 text-[11px] font-bold tabular-nums text-emerald-300"
        aria-live="polite"
      >
        {volumePct}%
      </span>
    </div>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => {
            if (v) stopPreview();
            return !v;
          });
        }}
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition hover:bg-white/5"
        aria-expanded={open}
      >
        <span className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold text-white/90">
          <Music2 className="h-4 w-4 shrink-0 text-glow-emerald" aria-hidden />
          <span className="truncate">{t.shorts.bgmToggle}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-2">
          {value.bgmUrl && (
            <span className="max-w-[7rem] truncate rounded-full bg-glow-emerald/15 px-2 py-0.5 text-[10px] font-medium text-glow-emerald">
              {selectedLabel}
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 text-white/85 transition ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-white/10 px-3 py-3">
          <div>
            <p className="mb-2 text-xs font-medium text-white/90">
              {t.shorts.bgmPresetsLabel}
              <span className="ml-1.5 font-semibold text-red-500">
                {t.shorts.bgmCommercialUse}
              </span>
            </p>
            <div className="mb-2 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setCategory("all")}
                className={`rounded-lg px-2.5 py-1.5 text-center text-[10px] font-semibold transition ${
                  category === "all"
                    ? "bg-glow-emerald/20 text-glow-emerald ring-1 ring-glow-emerald/40"
                    : "bg-white/5 text-white/90 hover:bg-white/10 hover:text-white"
                }`}
              >
                {t.shorts.bgmCategoryAll} ({BGM_LIBRARY.length})
              </button>
              {BGM_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`rounded-lg px-2.5 py-1.5 text-center text-[10px] font-semibold transition ${
                    category === cat
                      ? "bg-glow-emerald/20 text-glow-emerald ring-1 ring-glow-emerald/40"
                      : "bg-white/5 text-white/90 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {bgmCategoryLabel(cat)} ({categoryCounts[cat]})
                </button>
              ))}
            </div>
            <p className="mb-2 text-[11px] text-white/85">
              {category === "all"
                ? `전체 ${tracks.length}곡`
                : `${bgmCategoryLabel(category)} · ${tracks.length}곡`}
            </p>
            <div className="mb-2 rounded-lg border border-white/10 bg-black/25 px-2.5 py-2">
              {volumeSlider}
            </div>
            <ul
              key={category}
              ref={listRef}
              className="bgm-track-scroll max-h-64 space-y-2 overflow-y-auto overscroll-contain pr-1.5 [scrollbar-gutter:stable]"
            >
              {tracks.map((item, trackIndex) => {
                const url = resolveBgmUrl(item);
                const selected = value.bgmUrl === url;
                const playing = previewId === item.id;
                const fullFilename = bgmFilenameFromObjectKey(item.objectKey);
                const listNo = String(trackIndex + 1).padStart(2, "0");
                return (
                  <li key={`${item.category}:${item.objectKey}`}>
                    <div
                      className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 transition ${
                        selected
                          ? "border-2 border-emerald-400 bg-emerald-400/25 shadow-[0_0_0_1px_rgba(52,211,153,0.55),0_0_18px_rgba(16,185,129,0.35)]"
                          : "border border-white/10 bg-black/25 hover:border-white/20"
                      }`}
                      title={fullFilename}
                    >
                      <button
                        type="button"
                        onClick={() => selectTrack(url, item.title)}
                        className="min-w-0 flex-1 text-left"
                        title={fullFilename}
                      >
                        <p
                          className={`truncate text-sm font-medium ${
                            selected ? "text-emerald-100" : "text-white"
                          }`}
                        >
                          <span
                            className={`mr-1.5 tabular-nums ${
                              selected ? "text-emerald-300/80" : "text-white/75"
                            }`}
                          >
                            {listNo}.
                          </span>
                          {item.title}
                          {selected && (
                            <span className="ml-1.5 inline-block rounded-full bg-emerald-400 px-1.5 py-0.5 align-middle text-[9px] font-bold uppercase tracking-wide text-black">
                              ON
                            </span>
                          )}
                        </p>
                        <p
                          className={`truncate text-[11px] ${
                            selected ? "text-emerald-100/70" : "text-white/80"
                          }`}
                          title={fullFilename}
                        >
                          {bgmCategoryLabel(item.category)} · {fullFilename}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void togglePreview(item.id, url, item.title)
                        }
                        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition ${
                          selected
                            ? "bg-emerald-400/30 hover:bg-emerald-400/45"
                            : "bg-white/10 hover:bg-white/15"
                        }`}
                        aria-label={
                          playing ? t.shorts.bgmPause : t.shorts.bgmPlay
                        }
                        title={playing ? t.shorts.bgmPause : t.shorts.bgmPlay}
                      >
                        {playing ? (
                          <Pause className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <Play className="h-3.5 w-3.5" aria-hidden />
                        )}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-white/90">
              {t.shorts.bgmUploadLabel}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,.mp3,.wav"
              className="hidden"
              onChange={(e) => {
                onUpload(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-black/20 px-3 py-2.5 text-xs font-semibold text-white/80 transition hover:border-white/35 hover:bg-white/5"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden />
              {t.shorts.bgmUploadCta}
            </button>
            <p className="mt-1.5 text-[10px] text-white/75">
              {t.shorts.bgmUploadHint}
            </p>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-white/90">
              <span>{t.shorts.bgmVolume}</span>
              <span className="min-w-0 truncate text-[11px] text-white/85">
                {selectedLabel}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={SHORTS_BGM_VOLUME_MIN}
                max={SHORTS_BGM_VOLUME_MAX}
                step={0.01}
                value={clampBgmVolume(value.bgmVolume)}
                onChange={(e) => setVolume(Number(e.target.value))}
                aria-label={t.shorts.bgmVolume}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={volumePct}
                aria-valuetext={`${volumePct}%`}
                className="min-w-0 flex-1 accent-emerald-400"
              />
              <span
                className="inline-flex w-12 shrink-0 items-center justify-center rounded-md border border-emerald-400/40 bg-emerald-400/15 px-1.5 py-1 text-xs font-bold tabular-nums text-emerald-300"
                aria-live="polite"
              >
                {volumePct}%
              </span>
            </div>
          </div>

          {value.bgmUrl && (
            <button
              type="button"
              onClick={clearTrack}
              className="w-full rounded-lg py-1.5 text-[11px] text-white/85 transition hover:bg-white/5 hover:text-white"
            >
              {t.shorts.bgmClear}
            </button>
          )}

          {uploadError && (
            <p className="text-center text-[11px] text-red-300" role="alert">
              {uploadError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
