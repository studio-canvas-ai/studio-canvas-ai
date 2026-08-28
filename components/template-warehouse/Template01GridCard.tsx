"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  TEMPLATE_01_A4_ASPECT,
  type Template01Card,
} from "@/lib/templateWarehouse";
import Template01CardPreview from "@/components/template-warehouse/Template01CardPreview";

export type Template01GridCardProps = {
  card: Template01Card;
  removing?: boolean;
  /** Admin-only: duplicate (+) and trash controls. */
  canManage?: boolean;
  onPick: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
};

/** Single Template 01 warehouse card — A4 thumb, hover chrome, fade-out delete. */
export default function Template01GridCard({
  card,
  removing = false,
  canManage = false,
  onPick,
  onDuplicate,
  onRemove,
}: Template01GridCardProps) {
  return (
    <li
      className={`group relative transition-all duration-300 ease-out ${
        removing
          ? "pointer-events-none scale-95 opacity-0"
          : "scale-100 opacity-100"
      }`}
    >
      {canManage ? (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="absolute left-2.5 top-2.5 z-[3] inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-black/55 text-white/70 opacity-0 shadow-lg backdrop-blur-md transition-all duration-200 group-hover:opacity-100 hover:scale-105 hover:border-emerald-400/60 hover:bg-emerald-500/90 hover:text-white focus-visible:opacity-100"
            aria-label={`${card.title} 복사`}
            title="템플릿 복사"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="absolute right-2.5 top-2.5 z-[3] inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-black/55 text-white/70 opacity-0 shadow-lg backdrop-blur-md transition-all duration-200 group-hover:opacity-100 hover:scale-105 hover:border-rose-400/60 hover:bg-rose-500/90 hover:text-white focus-visible:opacity-100"
            aria-label={`${card.title} 삭제`}
            title="템플릿 삭제"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </>
      ) : null}
      <button
        type="button"
        onClick={onPick}
        className="flex w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-black/20 text-left shadow-[0_4px_24px_rgba(0,0,0,0.35)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-emerald-400/45 hover:shadow-[0_16px_48px_rgba(16,185,129,0.18)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
      >
        <div
          className="relative w-full overflow-hidden bg-slate-900"
          style={{ aspectRatio: String(TEMPLATE_01_A4_ASPECT) }}
          aria-hidden
        >
          <div className="h-full w-full transition-transform duration-300 ease-out group-hover:scale-[1.03]">
            <Template01CardPreview card={card} />
          </div>
        </div>
        <div className="space-y-0.5 border-t border-white/8 px-3 py-2.5 sm:py-3">
          <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-white sm:text-[14px]">
            {card.title}
          </p>
          <p className="truncate text-[11px] text-white/45">{card.desc}</p>
        </div>
      </button>
    </li>
  );
}
