"use client";

import { Loader2 } from "lucide-react";
import {
  formatById,
  type PrintFormatId,
  type PrintUseId,
} from "@/lib/printWizardTypes";

export type PreviewCanvasProps = {
  formatId: PrintFormatId;
  useId: PrintUseId;
  backgroundUrl: string | null;
  generating?: boolean;
  titlePreview?: string;
  subtitlePreview?: string;
};

export default function PreviewCanvas({
  formatId,
  backgroundUrl,
  generating = false,
  titlePreview = "",
  subtitlePreview = "",
}: PreviewCanvasProps) {
  const format = formatById(formatId);
  const aspect = format.aspect;

  return (
    <section className="flex h-full min-h-0 flex-col gap-2.5 rounded-2xl border border-slate-800 bg-[#121824] p-3 shadow-[0_8px_32px_rgba(0,0,0,0.35)] sm:p-4">
      <header className="shrink-0 px-0.5 pt-0.5">
        <h2 className="text-[15px] font-semibold tracking-tight text-slate-100 [word-break:keep-all] sm:text-base">
          AI 초안 뚝딱 생성기
        </h2>
      </header>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-[#0E1420] p-2.5 sm:p-3.5">
        <div
          className="relative w-full max-h-full overflow-hidden rounded-lg border border-slate-700/70 bg-[#0B0F19] shadow-[0_20px_60px_rgba(0,0,0,0.45)] transition-[aspect-ratio] duration-500 ease-out"
          style={{
            aspectRatio: `${aspect}`,
            maxWidth: aspect >= 1.2 ? "100%" : aspect < 0.85 ? "72%" : "88%",
          }}
        >
          {backgroundUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={backgroundUrl.slice(0, 64)}
              src={backgroundUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              style={{ animation: "pw-fade-in 0.7s ease forwards" }}
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(99,102,241,0.22),transparent_55%),radial-gradient(ellipse_at_80%_80%,rgba(16,185,129,0.12),transparent_50%),linear-gradient(160deg,#121824,#0B0F19)]" />
          )}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/15" />

          <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
            <p className="text-[10px] font-medium tracking-wider text-white/55 uppercase drop-shadow">
              Preview
            </p>
            <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-white drop-shadow sm:text-base [word-break:keep-all]">
              {titlePreview.trim() || "제목을 입력하면 여기에 미리 보여집니다"}
            </p>
            {subtitlePreview.trim() ? (
              <p className="mt-0.5 line-clamp-1 text-xs text-white/80 drop-shadow">
                {subtitlePreview.trim()}
              </p>
            ) : null}
          </div>

          {generating ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#0B0F19]/70 backdrop-blur-[2px]">
              <Loader2 className="h-7 w-7 animate-spin text-indigo-300" />
              <p className="text-xs font-medium text-slate-300">
                AI 배경 생성 중…
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
