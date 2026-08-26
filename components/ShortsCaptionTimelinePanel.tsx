"use client";

import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import {
  applyCaptionPosPreset,
  type ShortsCaptionPosPreset,
  type ShortsCaptionSegment,
} from "@/lib/shortsCaptions";

function formatSec(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00.0";
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

type Props = {
  captions: ShortsCaptionSegment[];
  activeCaptionId: string | null;
  currentTime: number;
  generating: boolean;
  error: string | null;
  disabled?: boolean;
  onGenerate: () => void;
  onChange: (next: ShortsCaptionSegment[]) => void;
  onSelect: (id: string) => void;
};

/**
 * Whisper STT caption list — edit text, preset vertical position, highlight by playhead.
 */
export default function ShortsCaptionTimelinePanel({
  captions,
  activeCaptionId,
  currentTime,
  generating,
  error,
  disabled,
  onGenerate,
  onChange,
  onSelect,
}: Props) {
  const { t } = useI18n();

  const patch = (id: string, partial: Partial<ShortsCaptionSegment>) => {
    onChange(captions.map((c) => (c.id === id ? { ...c, ...partial } : c)));
  };

  const remove = (id: string) => {
    onChange(captions.filter((c) => c.id !== id));
  };

  const setPreset = (id: string, preset: ShortsCaptionPosPreset) => {
    onChange(
      captions.map((c) =>
        c.id === id ? applyCaptionPosPreset(c, preset) : c
      )
    );
  };

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-white/80">
            {t.shorts.studioCaptionsTitle}
          </p>
          <p className="mt-0.5 text-[11px] text-white/80">
            {t.shorts.studioCaptionsHint}
          </p>
        </div>
        <button
          type="button"
          disabled={disabled || generating}
          onClick={onGenerate}
          className="inline-flex items-center gap-1.5 rounded-lg border border-glow-emerald/40 bg-glow-emerald/15 px-3 py-2 text-xs font-bold text-white transition hover:bg-glow-emerald/25 disabled:opacity-50"
        >
          {generating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-3.5 w-3.5 text-glow-emerald" aria-hidden />
          )}
          {generating
            ? t.shorts.studioCaptionsGenerating
            : t.shorts.studioCaptionsGenerate}
        </button>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-200">
          {error}
        </p>
      ) : null}

      {captions.length === 0 ? (
        <p className="text-[11px] text-white/75">{t.shorts.studioCaptionsEmpty}</p>
      ) : (
        <ul className="max-h-64 space-y-2 overflow-y-auto pr-0.5">
          {captions.map((seg, i) => {
            const liveActive =
              currentTime >= seg.startSec && currentTime < seg.endSec;
            const selected = seg.id === activeCaptionId;
            return (
              <li
                key={seg.id}
                className={`rounded-lg border px-2.5 py-2 transition ${
                  liveActive
                    ? "border-glow-emerald/50 bg-glow-emerald/10"
                    : selected
                      ? "border-white/25 bg-white/5"
                      : "border-white/10 bg-black/25"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(seg.id)}
                  className="mb-1.5 flex w-full items-center justify-between gap-2 text-left"
                >
                  <span className="text-[10px] font-semibold text-white/90">
                    #{i + 1} · {formatSec(seg.startSec)} –{" "}
                    {formatSec(seg.endSec)}
                  </span>
                  {liveActive ? (
                    <span className="text-[10px] font-bold text-glow-emerald">
                      {t.shorts.studioCaptionsPlaying}
                    </span>
                  ) : null}
                </button>
                <textarea
                  rows={2}
                  value={seg.text}
                  onFocus={() => onSelect(seg.id)}
                  onChange={(e) => patch(seg.id, { text: e.target.value })}
                  className="w-full resize-none rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white outline-none focus:border-glow-emerald/40"
                  aria-label={t.shorts.studioCaptionsTextLabel}
                />
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      ["top", t.shorts.studioVAlignTop],
                      ["mid", t.shorts.studioVAlignMiddle],
                      ["bottom", t.shorts.studioVAlignBottom],
                    ] as const
                  ).map(([preset, label]) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setPreset(seg.id, preset)}
                      className="rounded-md bg-white/10 px-2 py-1 text-[10px] font-medium text-white/90 transition hover:bg-white/15 hover:text-white"
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => remove(seg.id)}
                    className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-white/85 transition hover:bg-red-500/15 hover:text-red-200"
                    aria-label={t.shorts.studioCaptionsDelete}
                  >
                    <Trash2 className="h-3 w-3" aria-hidden />
                    {t.shorts.studioCaptionsDelete}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
