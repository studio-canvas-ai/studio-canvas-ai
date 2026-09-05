"use client";

import { ArrowUpRight } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { CONCEPT_GROUP_EMOJI, type StylePackMeta } from "@/lib/data";

type StyleHoverCardProps = {
  pack: StylePackMeta;
  name: string;
  description: string;
  badge: string;
  tags: string[];
  compositionLabel: string;
  animationDelay?: string;
  active?: boolean;
  /**
   * When the preview is open for another card, ignore pointer so the cursor
   * can travel to the popup / CTA without swapping styles.
   */
  pointerMuted?: boolean;
  onHoverStart: (styleId: string, cardEl: HTMLElement) => void;
  onHoverEnd: () => void;
  onMakeWithStyle: (styleId: string) => void;
  /** Touch / no-hover: tap card to open sample popup */
  onActivate?: (styleId: string, cardEl: HTMLElement) => void;
};

/**
 * Concept gallery card — hover opens the Before/After overlay (managed by parent).
 */
export default function StyleHoverCard({
  pack,
  name,
  description,
  badge,
  tags,
  compositionLabel,
  animationDelay,
  active = false,
  pointerMuted = false,
  onHoverStart,
  onHoverEnd,
  onMakeWithStyle,
  onActivate,
}: StyleHoverCardProps) {
  const { t } = useI18n();

  return (
    <article
      data-style-card={pack.id}
      className={`glass-card-hover group relative overflow-hidden transition-[box-shadow,opacity] duration-200 ${
        active ? "ring-1 ring-glow-violet/45 shadow-glow-sm z-[2]" : ""
      } ${pointerMuted ? "pointer-events-none opacity-55" : ""}`}
      style={animationDelay ? { animationDelay } : undefined}
      onMouseEnter={(e) => onHoverStart(pack.id, e.currentTarget)}
      onMouseLeave={onHoverEnd}
      onPointerEnter={(e) => onHoverStart(pack.id, e.currentTarget)}
      onPointerLeave={onHoverEnd}
      onClick={(e) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest("button[data-style-cta]")) return;
        onActivate?.(pack.id, e.currentTarget);
      }}
    >
      <div className="relative aspect-[4/5] overflow-hidden">
        <img
          src={pack.imageUrl}
          alt={name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          loading="lazy"
          draggable={false}
        />
        <div
          className={`absolute inset-0 bg-gradient-to-t ${pack.gradient} via-transparent to-transparent opacity-60`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/25 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-t from-navy via-navy/85 to-transparent px-3 pb-3 pt-14 sm:px-4 sm:pb-4">
          <span className="mb-1.5 inline-block rounded-full border border-white/20 bg-black/55 px-2 py-0.5 text-[10px] font-bold tracking-wider text-white backdrop-blur-md">
            {`${CONCEPT_GROUP_EMOJI[pack.conceptGroup]} ${badge}`}
          </span>
          <h3 className="font-display text-base font-semibold leading-tight text-white sm:text-lg">
            {name}
          </h3>
          <p className="mt-1 line-clamp-2 text-[11px] font-medium text-zinc-100/90 sm:text-xs">
            {description}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="rounded-md border border-violet-400/50 bg-violet-950/60 px-1.5 py-0.5 text-[9px] font-semibold text-violet-200 sm:text-[10px]">
              {compositionLabel}
            </span>
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-md border border-emerald-500/40 bg-emerald-950/50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300 sm:text-[10px]"
              >
                {`#${tag}`}
              </span>
            ))}
          </div>

          <button
            type="button"
            data-style-cta
            className="btn-primary mt-2.5 flex w-full items-center justify-center gap-1 py-2 text-xs font-bold text-white shadow-md sm:mt-3 sm:py-2.5 sm:text-sm"
            onClick={(e) => {
              e.stopPropagation();
              onMakeWithStyle(pack.id);
            }}
          >
            <span className="truncate">{t.creator.makeWithStyle}</span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
