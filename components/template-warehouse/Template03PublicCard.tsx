"use client";

import { Loader2, Trash2 } from "lucide-react";
import type { Template03PublicRecord } from "@/lib/template03Public";

export type Template03PublicCardProps = {
  item: Template03PublicRecord;
  deleting?: boolean;
  /** Admin-only delete control. */
  canDelete?: boolean;
  onPick: () => void;
  onDelete?: () => void;
};

/** Template 03 public catalog card — horizontal scroll strip. */
export default function Template03PublicCard({
  item,
  deleting = false,
  canDelete = false,
  onPick,
  onDelete,
}: Template03PublicCardProps) {
  return (
    <li
      className={`group relative flex w-[148px] shrink-0 flex-col overflow-hidden rounded-xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white shadow-sm ring-1 ring-emerald-100 transition-all duration-300 ${
        deleting ? "pointer-events-none scale-95 opacity-0" : ""
      }`}
    >
      {canDelete ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
          }}
          disabled={deleting}
          className="absolute right-1 top-1 z-[3] inline-flex h-6 w-6 items-center justify-center rounded-lg border border-white/15 bg-black/55 text-white/70 opacity-0 shadow-lg backdrop-blur-md transition-all duration-200 group-hover:opacity-100 hover:scale-105 hover:border-rose-400/60 hover:bg-rose-500/90 hover:text-white focus-visible:opacity-100 disabled:opacity-40"
          aria-label={`${item.title} 삭제`}
          title="템플릿 삭제"
        >
          {deleting ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="h-3 w-3" />
          )}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onPick}
        className="flex w-full flex-col text-left"
      >
        <div
          className="relative w-full overflow-hidden bg-slate-100"
          style={{ aspectRatio: String(210 / 297) }}
          aria-hidden
        >
          {item.thumbSrc || item.backgroundUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbSrc || item.backgroundUrl || ""}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className={`h-full w-full ${item.thumbClass}`} />
          )}
        </div>
        <div className="space-y-0.5 border-t border-slate-100 px-2 py-1.5">
          <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-slate-900">
            {item.title}
          </p>
          <p className="truncate text-[9px] text-slate-500">{item.subtitle}</p>
          {item.maskedNote ? (
            <p className="truncate text-[9px] text-amber-700">{item.maskedNote}</p>
          ) : null}
        </div>
      </button>
    </li>
  );
}
