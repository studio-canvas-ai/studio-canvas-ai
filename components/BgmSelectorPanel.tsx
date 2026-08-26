"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Music2, Pause, Play, Upload } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import {
  BGM_CATEGORIES,
  BGM_LIBRARY,
  bgmCategoryLabel,
  resolveBgmUrl,
  type BGMItem,
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
 */
export default function BgmSelectorPanel({ value, onChange }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<BgmCategory | "all">("all");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [libraryTracks, setLibraryTracks] = useState<BGMItem[]>(BGM_LIBRARY);
  const [libraryLoading, setLibraryLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const customObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLibraryLoading(true);
    void fetch("/api/bgm/tracks", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as { tracks?: BGMItem[] };
      })
      .then((data) => {
        if (cancelled || !data?.tracks?.length) return;
        setLibraryTracks(data.tracks);
      })
      .catch(() => {
        /* keep static BGM_LIBRARY */
      })
      .finally(() => {
        if (!cancelled) setLibraryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const tracks = useMemo(() => {
    if (category === "all") return libraryTracks;
    return libraryTracks.filter((item) => item.category === category);
  }, [category, libraryTracks]);

  const stopPreview = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    setPreviewId(null);
  }, []);

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

  const togglePreview = useCallback(
    async (id: string, url: string) => {
      const audio = audioRef.current;
      if (!audio) return;

      if (previewId === id) {
        stopPreview();
        return;
      }

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
    [previewId, stopPreview, t.shorts.bgmPreviewError, value.bgmVolume]
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
      selectTrack(url, name);
      void togglePreview(`custom:${url}`, url);
    },
    [selectTrack, t.shorts.bgmUploadTypeError, togglePreview]
  );

  const selectedLabel =
    value.bgmName.trim() ||
    (value.bgmUrl ? t.shorts.bgmCustomTrack : t.shorts.bgmNone);

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
            className={`h-4 w-4 text-white/50 transition ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-white/10 px-3 py-3">
          <div>
            <p className="mb-2 text-xs font-medium text-white/60">
              {t.shorts.bgmPresetsLabel}
            </p>
            <div className="mb-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setCategory("all")}
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${
                  category === "all"
                    ? "bg-glow-emerald/20 text-glow-emerald"
                    : "bg-white/5 text-white/55 hover:bg-white/10 hover:text-white/80"
                }`}
              >
                {t.shorts.bgmCategoryAll}
              </button>
              {BGM_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${
                    category === cat
                      ? "bg-glow-emerald/20 text-glow-emerald"
                      : "bg-white/5 text-white/55 hover:bg-white/10 hover:text-white/80"
                  }`}
                >
                  {bgmCategoryLabel(cat)}
                </button>
              ))}
            </div>
            {libraryLoading && tracks.length === 0 && (
              <p className="py-2 text-center text-[11px] text-white/40">…</p>
            )}
            <ul className="space-y-2">
              {tracks.map((item, trackIndex) => {
                const url = resolveBgmUrl(item);
                const selected = value.bgmUrl === url;
                const playing = previewId === item.id;
                const fullFilename = bgmFilenameFromObjectKey(item.objectKey);
                const listNo = String(trackIndex + 1).padStart(2, "0");
                return (
                  <li key={item.id}>
                    <div
                      className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 transition ${
                        selected
                          ? "border-glow-emerald/40 bg-glow-emerald/10"
                          : "border-white/10 bg-black/25 hover:border-white/20"
                      }`}
                      title={fullFilename}
                    >
                      <button
                        type="button"
                        onClick={() => selectTrack(url, item.title)}
                        className="min-w-0 flex-1 text-left"
                        title={fullFilename}
                      >
                        <p className="truncate text-sm font-medium text-white">
                          <span className="mr-1.5 tabular-nums text-white/35">
                            {listNo}.
                          </span>
                          {item.title}
                        </p>
                        <p className="truncate text-[11px] text-white/40" title={fullFilename}>
                          {bgmCategoryLabel(item.category)} · {fullFilename}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => void togglePreview(item.id, url)}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/15"
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
            <p className="mb-2 text-xs font-medium text-white/60">
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
            <p className="mt-1.5 text-[10px] text-white/35">
              {t.shorts.bgmUploadHint}
            </p>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-white/60">
              <span>{t.shorts.bgmVolume}</span>
              <span className="truncate text-white/80">
                {selectedLabel} · {Math.round(value.bgmVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={SHORTS_BGM_VOLUME_MIN}
              max={SHORTS_BGM_VOLUME_MAX}
              step={0.01}
              value={clampBgmVolume(value.bgmVolume)}
              onChange={(e) =>
                onChange({
                  ...value,
                  bgmVolume: clampBgmVolume(Number(e.target.value)),
                })
              }
              className="w-full accent-emerald-400"
            />
          </div>

          {value.bgmUrl && (
            <button
              type="button"
              onClick={clearTrack}
              className="w-full rounded-lg py-1.5 text-[11px] text-white/45 transition hover:bg-white/5 hover:text-white/70"
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
