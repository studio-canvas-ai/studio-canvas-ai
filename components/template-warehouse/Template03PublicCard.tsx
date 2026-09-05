"use client";

import type { Template03PublicRecord } from "@/lib/template03Public";
import Template03AdminDeleteButton from "@/components/template-warehouse/Template03AdminDeleteButton";

export type Template03PublicCardProps = {
  item: Template03PublicRecord;
  deleting?: boolean;
  /** Admin-only — when false the delete control is not mounted. */
  isAdmin?: boolean;
  onPick: () => void;
  onDelete?: (templateId: string) => void;
};

/** Template 03 public catalog card — horizontal scroll strip. */
export default function Template03PublicCard({
  item,
  deleting = false,
  isAdmin = false,
  onPick,
  onDelete,
}: Template03PublicCardProps) {
  return (
    <li
      className={`group relative flex w-[148px] shrink-0 flex-col overflow-hidden rounded-xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white shadow-sm ring-1 ring-emerald-100 transition-opacity duration-150 ${
        deleting ? "pointer-events-none opacity-40" : ""
      }`}
    >
      {isAdmin && onDelete ? (
        <Template03AdminDeleteButton
          templateId={item.id}
          templateTitle={item.title}
          deleting={deleting}
          onDelete={onDelete}
        />
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
