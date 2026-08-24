"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import { PRINT_PENDING_PROJECT_KEY } from "@/lib/wizard/wizardProduct";
import { PRINT_SMART_FORM_PATH } from "@/lib/printSmartForm";
import { readPrintWizardSession } from "@/lib/printWizardSession";
import type { PrintWizardState } from "@/lib/printWizardTypes";
import { resolvePrintAspect } from "@/lib/printWizardTypes";
import { smartInputsToTextLayers } from "@/lib/ai/formToDesign";
import {
  referencePrintStageSize,
  resolvePageTextLayersForExport,
} from "@/lib/printWizardTextLayers";
import { peekPendingStudioProject } from "@/lib/canvas/projectFile";
import { toDisplayImageSrc } from "@/lib/resultSession";

const AiTemplateStudio = dynamic(
  () => import("@/components/AiTemplateStudio"),
  { ssr: false }
);

/**
 * Step 3 — Print Agent studio.
 * Seeds shared core engine (agent mode) with saved Step-2 text layers
 * and backgrounds. Text stays on overlay planes; AI visuals stay separate.
 */
export default function PrintStudioPageClient() {
  const router = useRouter();
  const [session, setSession] = useState<PrintWizardState | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSession(readPrintWizardSession());
    setReady(true);
  }, []);

  const printAspect = useMemo(
    () =>
      session
        ? resolvePrintAspect(session.formatId, session.customSize)
        : 1,
    [session]
  );

  const referenceStage = useMemo(
    () => referencePrintStageSize(printAspect),
    [printAspect]
  );

  const overlayLayers = useMemo(() => {
    const pending = peekPendingStudioProject(PRINT_PENDING_PROJECT_KEY);
    if (pending?.studio.overlayLayers?.length) {
      return pending.studio.overlayLayers.map((layer) => ({
        ...layer,
        ranges: layer.ranges?.map((range) => ({ ...range })) ?? [],
      }));
    }
    if (!session) return [];
    const pages = session.textLayersByPage;
    const pageIndex = 0;
    if (pages?.some((page) => page?.length)) {
      return resolvePageTextLayersForExport(
        pages,
        pageIndex,
        session.inputs,
        session.pageCount
      ).map((layer) => ({
        ...layer,
        ranges: layer.ranges?.map((range) => ({ ...range })) ?? [],
      }));
    }
    return smartInputsToTextLayers(session.inputs);
  }, [session]);

  const backgroundUrl = useMemo(() => {
    if (!session) return null;
    const raw =
      session.backgroundUrls[0] || session.backgroundUrl || null;
    return raw ? toDisplayImageSrc(raw) : null;
  }, [session]);

  const formFields = useMemo(() => {
    if (!session) return null;
    return { ...session.inputs };
  }, [session]);

  const initialCustomPrint = useMemo(() => {
    if (!session?.customSize) return null;
    return {
      unit: session.customSize.unit,
      width: session.customSize.width,
      height: session.customSize.height,
    };
  }, [session?.customSize]);

  if (!ready) {
    return (
      <main className="print-wizard-shell relative min-h-screen overflow-hidden bg-[#0B0F19]">
        <Navbar />
        <div className="min-h-[50vh]" />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="print-wizard-shell relative min-h-screen overflow-x-hidden bg-[#0B0F19]">
        <Navbar />
        <section className="relative mx-auto flex min-h-[calc(100svh-3.5rem)] w-full max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
          <p className="text-sm text-amber-300/90">
            저장된 기획 데이터가 없습니다. 2단계부터 다시 시작해 주세요.
          </p>
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

  return (
    <main className="relative min-h-screen bg-[#0B0F19]">
      <div className="pointer-events-none absolute top-3 left-3 z-[40]">
        <Link
          href={PRINT_SMART_FORM_PATH}
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/50 px-3 py-1.5 text-[11px] font-semibold text-white/85 backdrop-blur-sm transition hover:bg-black/70"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          2단계로
        </Link>
      </div>
      <AiTemplateStudio
        mode="agent"
        embedded
        layout="print-wizard-step2"
        heading="AI 1분 인쇄물 에이전트"
        recentNamespace="screen_008"
        initialBackgroundUrl={backgroundUrl}
        initialOverlayLayers={overlayLayers}
        initialPrintAspect={printAspect}
        initialNaturalSize={{
          w: referenceStage.w,
          h: referenceStage.h,
        }}
        initialCustomPrint={initialCustomPrint}
        formFields={formFields}
        initialVisualStyle={session.visualStyle}
        pendingProjectKey={PRINT_PENDING_PROJECT_KEY}
        onBackToPlanning={() => router.push(PRINT_SMART_FORM_PATH)}
      />
    </main>
  );
}
