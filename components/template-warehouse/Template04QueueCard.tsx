"use client";

import { ExternalLink, ImageOff, Loader2 } from "lucide-react";
import type { Space4VaultMeta } from "@/lib/space4Client";

export type Template04QueueCardProps = {
  item: Space4VaultMeta;
  opening?: boolean;
  onOpenInEditor: () => void;
  /** Horizontal Template 04 row — fixed width card in a scroll strip. */
  compact?: boolean;
};

/** Template 04 admin queue card — open in Screen 26 for manual review & publish. */
export default function Template04QueueCard({
  item,
  opening = false,
  onOpenInEditor,
  compact = false,
}: Template04QueueCardProps) {
  const when = new Date(item.createdAt).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const hasThumb = Boolean(item.thumbSrc?.trim());

  return (
    <li
      className={
        compact
          ? "flex w-[148px] shrink-0 flex-col overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-b from-amber-50 to-white shadow-sm ring-1 ring-amber-100"
          : "flex flex-col overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-b from-amber-50 to-white shadow-sm ring-1 ring-amber-100"
      }
    >
      <div
        className="relative w-full overflow-hidden border-b border-slate-100 bg-white p-1"
        style={{ aspectRatio: String(210 / 297) }}
        aria-hidden
      >
        <div className="relative h-full w-full overflow-hidden rounded-md bg-white shadow-inner ring-1 ring-black/10">
          {hasThumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbSrc!}
              alt=""
              className="h-full w-full object-contain"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500">
              <ImageOff className="h-5 w-5 opacity-60" aria-hidden />
              <span className="text-[9px] font-semibold">미리보기 없음</span>
            </div>
          )}
        </div>
      </div>
      <div className="space-y-1 border-t border-slate-100 bg-white px-2 py-1.5">
        <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-slate-900">
          {item.label}
        </p>
        <p className="truncate text-[9px] text-slate-500 tabular-nums">{when}</p>
        <button
          type="button"
          disabled={opening}
          onClick={onOpenInEditor}
          className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-sky-300 bg-sky-50 px-1.5 py-1.5 text-[10px] font-bold leading-tight text-sky-900 transition hover:bg-sky-100 disabled:opacity-50 [word-break:keep-all]"
        >
          {opening ? (
            <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
          ) : (
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
          )}
          <span className={compact ? "truncate" : undefined}>
            {compact ? "에디터에서 열기" : "에디터에서 열기 및 수정 후 공개(03) 발행"}
          </span>
        </button>
      </div>
    </li>
  );
}
