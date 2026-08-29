"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import type { Space4VaultMeta } from "@/lib/space4Client";

export type Template04QueueCardProps = {
  item: Space4VaultMeta;
  opening?: boolean;
  onOpenInEditor: () => void;
};

/** Template 04 admin queue card — open in Screen 26 for manual review & publish. */
export default function Template04QueueCard({
  item,
  opening = false,
  onOpenInEditor,
}: Template04QueueCardProps) {
  const when = new Date(item.createdAt).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <li className="flex flex-col overflow-hidden rounded-xl border border-amber-400/25 bg-gradient-to-b from-amber-500/[0.08] to-black/25 shadow-sm">
      <div
        className="relative w-full overflow-hidden bg-slate-900"
        style={{ aspectRatio: String(210 / 297) }}
        aria-hidden
      >
        {item.thumbSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbSrc}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-slate-800 text-[10px] font-semibold text-white/40">
            .sca
          </div>
        )}
      </div>
      <div className="space-y-1 border-t border-white/8 px-2 py-1.5">
        <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-white">
          {item.label}
        </p>
        <p className="truncate text-[9px] text-white/40 tabular-nums">{when}</p>
        <button
          type="button"
          disabled={opening}
          onClick={onOpenInEditor}
          className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-sky-400/50 bg-sky-500/20 px-1.5 py-1.5 text-[10px] font-bold leading-tight text-sky-100 transition hover:bg-sky-500/35 disabled:opacity-50 [word-break:keep-all]"
        >
          {opening ? (
            <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
          ) : (
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
          )}
          <span>에디터에서 열기 및 수정 후 공개(03) 발행</span>
        </button>
      </div>
    </li>
  );
}
