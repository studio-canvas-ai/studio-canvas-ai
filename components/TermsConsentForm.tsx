"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { safePostConsentPath } from "@/lib/termsConsent";
import { CONTENT_LICENSE_CLAUSE_KR } from "@/lib/legalContent";

export default function TermsConsentForm({
  nextPath,
}: {
  nextPath: string | null;
}) {
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = acceptTerms && acceptPrivacy && !busy;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!acceptTerms || !acceptPrivacy || busy) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/terms/agree", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          acceptTerms: true,
          acceptPrivacy: true,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "동의 처리에 실패했습니다.");
      }
      window.location.replace(safePostConsentPath(nextPath));
    } catch (err) {
      setError(err instanceof Error ? err.message : "동의 처리에 실패했습니다.");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto w-full max-w-lg space-y-6 rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-md sm:p-8"
    >
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
          약관 동의
        </h1>
        <p className="text-sm leading-relaxed text-white/60">
          Studio Canvas AI를 이용하려면 아래 필수 약관에 동의해 주세요. 동의 후
          계정이 등록됩니다.
        </p>
      </div>

      <aside className="rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-500/[0.08] via-white/[0.03] to-transparent p-4 shadow-[0_10px_32px_rgba(0,0,0,0.35)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-200/85">
          콘텐츠의 권리 및 이용허락
        </p>
        <p className="mt-2 text-[13px] leading-6 text-white/80 sm:text-sm sm:leading-7">
          “{CONTENT_LICENSE_CLAUSE_KR}”
        </p>
        <p className="mt-2 text-[11px] leading-5 text-white/45">
          자세한 내용은{" "}
          <Link
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-white/70"
          >
            이용약관 제7조
          </Link>
          에서 확인할 수 있습니다.
        </p>
      </aside>

      <div className="space-y-3">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:border-white/20">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-emerald-500"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            disabled={busy}
          />
          <span className="text-sm text-white/85">
            <span className="font-medium text-amber-300/90">[필수]</span>{" "}
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-white"
              onClick={(e) => e.stopPropagation()}
            >
              이용약관
            </Link>
            에 동의합니다
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:border-white/20">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-emerald-500"
            checked={acceptPrivacy}
            onChange={(e) => setAcceptPrivacy(e.target.checked)}
            disabled={busy}
          />
          <span className="text-sm text-white/85">
            <span className="font-medium text-amber-300/90">[필수]</span>{" "}
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-white"
              onClick={(e) => e.stopPropagation()}
            >
              개인정보처리방침
            </Link>
            에 동의합니다
          </span>
        </label>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black transition enabled:hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35"
      >
        {busy ? "처리 중…" : "동의하고 시작하기"}
      </button>
    </form>
  );
}
