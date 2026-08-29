"use client";

import { Loader2, Send, X } from "lucide-react";

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
    <div className="flex shrink-0 flex-col gap-2 rounded-xl border-2 border-emerald-400/60 bg-gradient-to-r from-emerald-600/25 via-emerald-500/15 to-amber-500/10 px-3 py-2.5 shadow-[0_0_28px_rgba(16,185,129,0.28)] sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4 sm:py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-extrabold tracking-tight text-emerald-50 sm:text-sm">
          Template 04 검수 모드
        </p>
        <p className="mt-0.5 text-[11px] font-medium text-emerald-100/80 sm:text-xs">
          수정 완료 후 → 공개 템플릿(03)으로 발행
        </p>
        <p className="mt-1 truncate text-[10px] text-white/55 sm:text-[11px]">
          {label}
        </p>
      </div>
      <div className="flex shrink-0 items-stretch gap-2 sm:items-center">
        <button
          type="button"
          disabled={publishing}
          onClick={onCancel}
          className="inline-flex items-center justify-center gap-1 rounded-lg border border-white/20 bg-black/25 px-3 py-2.5 text-[12px] font-semibold text-white/75 transition hover:bg-white/10 disabled:opacity-50 sm:py-3"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          취소
        </button>
        <button
          type="button"
          disabled={publishing}
          onClick={onPublish}
          className="inline-flex min-h-[48px] min-w-[168px] flex-1 items-center justify-center gap-2 rounded-xl border-2 border-emerald-300 bg-emerald-500 px-5 py-3 text-[15px] font-black tracking-tight text-white shadow-[0_6px_20px_rgba(16,185,129,0.55)] transition hover:bg-emerald-400 hover:shadow-[0_8px_28px_rgba(16,185,129,0.7)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[52px] sm:min-w-[200px] sm:flex-none sm:px-7 sm:text-base"
        >
          {publishing ? (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
          ) : (
            <Send className="h-5 w-5 shrink-0" aria-hidden />
          )}
          <span>{publishing ? "발행 중…" : "공개(03) 발행"}</span>
        </button>
      </div>
    </div>
  );
}
