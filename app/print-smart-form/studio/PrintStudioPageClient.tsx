"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Layers } from "lucide-react";
import Navbar from "@/components/Navbar";
import { useCredits } from "@/components/CreditsProvider";
import {
  isPrintSmartFormAdminEmail,
  PRINT_SMART_FORM_PATH,
} from "@/lib/printSmartForm";
import { readPrintWizardSession } from "@/lib/printWizardSession";
import type { PrintWizardState } from "@/lib/printWizardTypes";
import {
  formatById,
  pageCountLabel,
  useById,
} from "@/lib/printWizardTypes";

export default function PrintStudioPageClient() {
  const router = useRouter();
  const { authUser, socialProvidersLoaded } = useCredits();
  const allowed = isPrintSmartFormAdminEmail(authUser?.email);
  const [session, setSession] = useState<PrintWizardState | null>(null);

  useEffect(() => {
    if (!socialProvidersLoaded) return;
    if (!allowed) {
      router.replace("/");
      return;
    }
    setSession(readPrintWizardSession());
  }, [allowed, router, socialProvidersLoaded]);

  if (!socialProvidersLoaded || !allowed) {
    return (
      <main className="print-wizard-shell relative min-h-screen overflow-hidden bg-[#0B0F19]">
        <Navbar />
        <div className="min-h-[50vh]" />
      </main>
    );
  }

  const format = session ? formatById(session.formatId) : null;
  const use = session ? useById(session.useId) : null;

  return (
    <main className="print-wizard-shell relative min-h-screen overflow-x-hidden bg-[#0B0F19]">
      <Navbar />
      <section className="relative mx-auto flex min-h-[calc(100svh-3.5rem)] w-full max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-800 bg-[#121824] shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
          <Layers className="h-7 w-7 text-indigo-300" aria-hidden />
        </div>
        <p className="text-[11px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
          3단계 · 와이드 멀티 스튜디오
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl [word-break:keep-all]">
          AI 초안 스튜디오 준비 중
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-400 sm:text-base">
          2단계에서 설정한 규격·배경·프롬프트 데이터를 받아 멀티 페이지 편집
          화면이 여기에 연결됩니다.
        </p>

        {session ? (
          <div className="mt-8 w-full max-w-md rounded-2xl border border-slate-800 bg-[#121824] p-5 text-left text-sm text-slate-300 shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
            <p>
              <span className="text-slate-500">규격</span>{" "}
              {format?.label ?? session.formatId}
            </p>
            <p className="mt-1.5">
              <span className="text-slate-500">용도</span>{" "}
              {use?.label ?? session.useId}
            </p>
            <p className="mt-1.5">
              <span className="text-slate-500">장수</span>{" "}
              {pageCountLabel(session.pageCount)}
            </p>
            <p className="mt-1.5 line-clamp-3">
              <span className="text-slate-500">프롬프트</span>{" "}
              {session.mainPrompt.trim() || "—"}
            </p>
            <p className="mt-1.5 line-clamp-2">
              <span className="text-slate-500">제목</span>{" "}
              {session.inputs.title.trim() || "—"}
            </p>
          </div>
        ) : (
          <p className="mt-6 text-sm text-amber-300/90">
            저장된 기획 데이터가 없습니다. 2단계부터 다시 시작해 주세요.
          </p>
        )}

        <Link
          href={PRINT_SMART_FORM_PATH}
          className="mt-8 inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-[#121824] px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800/60"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          2단계로 돌아가기
        </Link>
      </section>
    </main>
  );
}
