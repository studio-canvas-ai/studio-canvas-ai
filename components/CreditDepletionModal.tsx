"use client";

import { Zap, ArrowUpRight, X } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";

export default function CreditDepletionModal() {
  const { t } = useI18n();
  const { showCreditModal, setShowCreditModal, setShowTopUpModal } = useCredits();

  if (!showCreditModal) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-navy/80 backdrop-blur-sm"
        aria-label="Close"
        onClick={() => setShowCreditModal(false)}
      />
      <div className="glass-card relative z-10 w-full max-w-md p-6 sm:p-8">
        <button
          type="button"
          onClick={() => setShowCreditModal(false)}
          className="absolute top-4 right-4 rounded-lg p-1.5 text-white/40 hover:bg-white/5 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-2 text-3xl">⚡</div>
        <h2 className="mb-2 text-xl font-semibold text-white">{t.credits.emptyTitle}</h2>
        <p className="mb-6 text-sm text-white/50">{t.credits.emptyDesc}</p>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              setShowCreditModal(false);
              setShowTopUpModal(true);
            }}
            className="btn-primary w-full justify-center py-3 text-sm"
          >
            <Zap className="h-4 w-4 shrink-0" />
            <span>{t.credits.topup}</span>
          </button>
          <Link
            href="/pricing"
            onClick={() => setShowCreditModal(false)}
            className="btn-secondary w-full justify-center py-3 text-sm"
          >
            <ArrowUpRight className="h-4 w-4 shrink-0" />
            <span>{t.credits.upgrade}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
