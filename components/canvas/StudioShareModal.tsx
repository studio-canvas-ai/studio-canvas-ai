"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, Download, Loader2, Share2, X } from "lucide-react";

export type StudioShareModalProps = {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  error?: string | null;
  previewUrl: string | null;
  title: string;
  description: string;
  /** Unique image URL (or placeholder hint before upload). */
  linkUrl: string;
  projectLabel?: string;
  sharing?: boolean;
  copyBusy?: boolean;
  onNativeShare: () => void;
  onCopyLink: () => void;
  onDownloadImage?: () => void;
};

/** Screen 26 — stable share sheet (preview stays open until user dismisses). */
export default function StudioShareModal({
  open,
  onClose,
  loading,
  error = null,
  previewUrl,
  title,
  description,
  linkUrl,
  projectLabel,
  sharing = false,
  copyBusy = false,
  onNativeShare,
  onCopyLink,
  onDownloadImage,
}: StudioShareModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [portalReady, setPortalReady] = useState(false);
  const ignoreOutsideUntilRef = useRef(0);

  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";
  const hasImage = Boolean(previewUrl) && !error && !loading;

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    ignoreOutsideUntilRef.current = Date.now() + 320;
    const onDoc = (e: MouseEvent) => {
      if (Date.now() < ignoreOutsideUntilRef.current) return;
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", onDoc);
    }, 0);
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !portalReady) return null;

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-share-title"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="닫기"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="border-b border-slate-100 px-5 pt-5 pb-4">
          <h2
            id="studio-share-title"
            className="pr-8 text-lg font-semibold text-slate-900"
          >
            {title}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            {description}
          </p>
          {projectLabel ? (
            <p className="mt-2 truncate text-xs font-medium text-indigo-700">
              {projectLabel}
            </p>
          ) : null}
        </div>

        <div className="px-5 py-4">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {loading ? (
              <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 px-4 py-10 text-sm text-slate-600">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                <span>미리보기 이미지 준비 중…</span>
              </div>
            ) : error ? (
              <div className="flex min-h-[180px] items-center justify-center px-4 py-8 text-center text-sm text-rose-600">
                {error}
              </div>
            ) : previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="공유 미리보기"
                className="mx-auto max-h-[240px] w-full object-contain"
              />
            ) : (
              <div className="flex min-h-[180px] items-center justify-center px-4 py-8 text-sm text-slate-500">
                공유할 미리보기가 없습니다.
              </div>
            )}
          </div>

          <p
            className="mt-3 truncate text-[11px] text-slate-500"
            title={linkUrl}
          >
            {linkUrl}
          </p>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-4">
          {canNativeShare ? (
            <button
              type="button"
              disabled={!hasImage || sharing || copyBusy}
              onClick={onNativeShare}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-110 disabled:opacity-50"
            >
              {sharing ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Share2 className="h-4 w-4 shrink-0" aria-hidden />
              )}
              기기로 공유하기
            </button>
          ) : null}
          <button
            type="button"
            disabled={!hasImage || copyBusy || sharing}
            onClick={onCopyLink}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            {copyBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Copy className="h-4 w-4 shrink-0" aria-hidden />
            )}
            {copyBusy ? "고유 링크 생성 중…" : "링크 복사"}
          </button>
          {onDownloadImage ? (
            <button
              type="button"
              disabled={!hasImage || copyBusy}
              onClick={onDownloadImage}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
            >
              <Download className="h-4 w-4 shrink-0" aria-hidden />
              이미지 저장
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex w-full items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
          >
            닫기
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
