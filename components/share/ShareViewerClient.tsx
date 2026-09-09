"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import Link from "next/link";

type SharePayload = {
  ok: boolean;
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  contentType?: string;
};

export default function ShareViewerClient({ shareId }: { shareId: string }) {
  const [data, setData] = useState<SharePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/share/${encodeURIComponent(shareId)}`, {
          cache: "no-store",
        });
        const json = (await res.json().catch(() => null)) as SharePayload | null;
        if (cancelled) return;
        if (!res.ok || !json?.ok || !json.imageUrl) {
          setError("공유 이미지를 찾을 수 없습니다. 링크가 만료되었을 수 있습니다.");
          setData(null);
          return;
        }
        setData(json);
      } catch {
        if (!cancelled) {
          setError("공유 페이지를 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  const saveToPhone = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setSavedMsg(null);
    try {
      const res = await fetch(
        `/api/share/${encodeURIComponent(shareId)}/download`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("download_failed");
      const blob = await res.blob();
      const contentType = blob.type || data?.contentType || "image/png";
      const ext = contentType.includes("jpeg") || contentType.includes("jpg")
        ? "jpg"
        : contentType.includes("webp")
          ? "webp"
          : "png";
      const filename = `studio-canvas-${shareId.slice(0, 8)}.${ext}`;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      setSavedMsg("다운로드가 시작되었습니다. 갤러리에서 확인해 주세요.");
    } catch {
      // Fallback: open same-origin download URL (helps some in-app browsers).
      try {
        window.location.href = `/api/share/${encodeURIComponent(shareId)}/download`;
        setSavedMsg("다운로드 페이지로 이동합니다.");
      } catch {
        setSavedMsg("저장에 실패했습니다. 이미지를 길게 눌러 저장해 주세요.");
      }
    } finally {
      setSaving(false);
    }
  }, [data?.contentType, saving, shareId]);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-950 text-white">
      <header className="shrink-0 border-b border-white/10 px-4 py-3">
        <p className="text-[11px] font-semibold tracking-wide text-amber-300/90 uppercase">
          Studio Canvas AI
        </p>
        <h1 className="mt-0.5 text-base font-semibold leading-snug">
          {data?.title || "공유 인쇄물"}
        </h1>
      </header>

      <main className="flex min-h-0 flex-1 flex-col px-4 py-4">
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80">
          {loading ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-sm text-white/60">
              <Loader2 className="h-7 w-7 animate-spin text-amber-300" />
              이미지 불러오는 중…
            </div>
          ) : error ? (
            <p className="px-6 py-16 text-center text-sm text-rose-300">{error}</p>
          ) : data?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.imageUrl}
              alt={data.title || "공유 이미지"}
              className="max-h-[min(70dvh,640px)] w-full object-contain"
            />
          ) : null}
        </div>

        {data?.description ? (
          <p className="mt-3 text-center text-sm leading-relaxed text-white/55">
            {data.description}
          </p>
        ) : null}

        {savedMsg ? (
          <p className="mt-2 text-center text-xs font-medium text-emerald-300">
            {savedMsg}
          </p>
        ) : null}
      </main>

      <footer className="sticky bottom-0 shrink-0 border-t border-white/10 bg-slate-950/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md">
        <button
          type="button"
          disabled={loading || !!error || !data || saving}
          onClick={() => void saveToPhone()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-4 text-[15px] font-bold text-white shadow-lg shadow-orange-900/40 transition hover:brightness-110 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : (
            <Download className="h-5 w-5 shrink-0" aria-hidden />
          )}
          {saving ? "저장 중…" : "내 폰에 이미지 즉시 저장하기"}
        </button>
        <p className="mt-2 text-center text-[11px] text-white/40">
          길게 누르지 않아도 됩니다. 버튼 한 번으로 저장됩니다.
        </p>
        <Link
          href="/"
          className="mt-2 block text-center text-[11px] font-medium text-white/50 underline-offset-2 hover:text-white/80 hover:underline"
        >
          Studio Canvas AI 홈으로
        </Link>
      </footer>
    </div>
  );
}
