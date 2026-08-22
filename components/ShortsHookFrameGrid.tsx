"use client";

import { ArrowRight, Check, Sparkles } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import type { ShortsHookFrame } from "@/lib/shortsHookShared";

type Props = {
  hooks: ShortsHookFrame[];
  selectedId: string | null;
  onSelect: (frame: ShortsHookFrame) => void;
  /** Navigate to phase-4 text edit studio with selectedHook + video. */
  onContinueToStudio?: () => void;
};

/** Phase-3 grid: pick one AI hook frame for the text edit studio (phase 4). */
export default function ShortsHookFrameGrid({
  hooks,
  selectedId,
  onSelect,
  onContinueToStudio,
}: Props) {
  const { t } = useI18n();

  if (!hooks.length) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white sm:text-base">
            {t.shorts.hooksTitle}
          </h2>
          <p className="mt-0.5 text-xs text-white/45">{t.shorts.hooksHint}</p>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {hooks.map((hook, i) => {
          const selected = selectedId === hook.id;
          return (
            <li key={hook.id}>
              <button
                type="button"
                onClick={() => onSelect(hook)}
                className={`group relative block w-full overflow-hidden rounded-xl text-left ring-2 transition ${
                  selected
                    ? "ring-glow-emerald shadow-[0_0_0_1px_rgba(52,211,153,0.35)]"
                    : "ring-white/10 hover:ring-white/30"
                }`}
                aria-pressed={selected}
                aria-label={`${t.shorts.hookLabel} ${i + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={hook.imageUrl}
                  alt=""
                  className="aspect-[9/16] w-full bg-black/50 object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-6">
                  <div className="flex items-center justify-between gap-1 text-[10px] text-white/80">
                    <span>
                      {t.shorts.hookLabel} {i + 1}
                    </span>
                    <span>{hook.timestampSec.toFixed(1)}s</span>
                  </div>
                </div>
                {selected && (
                  <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-glow-emerald text-navy shadow">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {selectedId && (
        <div className="space-y-3 pt-1">
          <p className="text-center text-xs text-glow-emerald/90 sm:text-sm">
            {t.shorts.hookSelectedNext}
          </p>
          <button
            type="button"
            onClick={onContinueToStudio}
            className="btn-primary group mx-auto flex w-full max-w-md items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold shadow-lg shadow-violet-900/40 sm:text-base"
          >
            <Sparkles className="h-5 w-5 shrink-0" aria-hidden />
            <span>{t.shorts.goToTextStudio}</span>
            <ArrowRight
              className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </button>
        </div>
      )}
    </div>
  );
}
