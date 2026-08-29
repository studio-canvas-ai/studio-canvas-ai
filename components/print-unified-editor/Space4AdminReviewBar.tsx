"use client";

import { Loader2, Send } from "lucide-react";

export type Space4AdminReviewBarProps = {
  label: string;
  publishing?: boolean;
  onPublish: () => void;
  onCancel: () => void;
};

/** Admin banner — manual Template 04 review → publish to Template 03. */
export default function Space4AdminReviewBar({
  label,
  publishing = false,
  onPublish,
  onCancel,
}: Space4AdminReviewBarProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold text-amber-100">
          Template 04 검수 · 에디터 수정 후 공개(03) 발행
        </p>
        <p className="truncate text-[10px] text-amber-100/70">{label}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          disabled={publishing}
          onClick={onCancel}
          className="rounded-md border border-white/15 px-2 py-1 text-[10px] font-semibold text-white/70 transition hover:bg-white/10 disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="button"
          disabled={publishing}
          onClick={onPublish}
          className="inline-flex items-center gap-1 rounded-md border border-emerald-400/50 bg-emerald-500/25 px-2.5 py-1 text-[10px] font-bold text-emerald-50 transition hover:bg-emerald-500/40 disabled:opacity-50"
        >
          {publishing ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <Send className="h-3 w-3" aria-hidden />
          )}
          공개(03) 발행
        </button>
      </div>
    </div>
  );
}
