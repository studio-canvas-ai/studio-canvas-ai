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
            className="absolute left-1.5 top-1.5 z-[3] inline-flex h-6 w-6 items-center justify-center rounded-lg border border-white/15 bg-black/55 text-white/70 opacity-0 shadow-lg backdrop-blur-md transition-all duration-200 group-hover:opacity-100 hover:scale-105 hover:border-emerald-400/60 hover:bg-emerald-500/90 hover:text-white focus-visible:opacity-100"
            aria-label={`${card.title} 복사`}
            title="템플릿 복사"
          >
            <Plus className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="absolute right-1.5 top-1.5 z-[3] inline-flex h-6 w-6 items-center justify-center rounded-lg border border-white/15 bg-black/55 text-white/70 opacity-0 shadow-lg backdrop-blur-md transition-all duration-200 group-hover:opacity-100 hover:scale-105 hover:border-rose-400/60 hover:bg-rose-500/90 hover:text-white focus-visible:opacity-100"
            aria-label={`${card.title} 삭제`}
            title="템플릿 삭제"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </>
      ) : null}
      <button
        type="button"
        onClick={onPick}
        className="flex w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
      >
        <div
          className="relative w-full overflow-hidden bg-slate-100"
          style={{ aspectRatio: String(TEMPLATE_01_A4_ASPECT) }}
          aria-hidden
        >
          <div className="h-full w-full transition-transform duration-300 ease-out group-hover:scale-[1.03]">
            <Template01CardPreview card={card} />
          </div>
        </div>
        <div className="space-y-0.5 border-t border-slate-100 px-2 py-1.5 sm:px-2.5 sm:py-2">
          <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-slate-900 sm:text-[12px]">
            {card.title}
          </p>
          <p className="truncate text-[9px] text-slate-500 sm:text-[10px]">
            {card.desc}
          </p>
        </div>
      </button>
    </li>
  );
}
