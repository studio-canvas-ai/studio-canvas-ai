"use client";

import { useState } from "react";
import { X, Zap } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";
import { CREDIT_PACKS } from "@/lib/data";

export default function CreditTopUpModal() {
  const { t } = useI18n();
  const { showTopUpModal, setShowTopUpModal, purchaseCreditPack } = useCredits();
  const [busy, setBusy] = useState(false);

  if (!showTopUpModal) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-navy/80 backdrop-blur-sm"
        aria-label="Close"
        onClick={() => setShowTopUpModal(false)}
      />
      <div className="glass-card relative z-10 w-full max-w-md p-6 sm:p-8">
        <button
          type="button"
          onClick={() => setShowTopUpModal(false)}
          className="absolute top-4 right-4 rounded-lg p-1.5 text-white/40 hover:bg-white/5"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mb-2 text-2xl">⚡</div>
        <h2 className="mb-1 text-xl font-semibold">{t.credits.topupTitle}</h2>
        <p className="mb-5 text-sm text-white/50">{t.credits.topupDesc}</p>
        <div className="flex flex-col gap-2">
          {CREDIT_PACKS.map((pack) => (
            <button
              key={pack.id}
              type="button"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                purchaseCreditPack(pack.id);
                setBusy(false);
              }}
              className="btn-secondary flex w-full items-center justify-between py-3 text-sm disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-300" />
                {t.credits.packLabel
                  .replace("{credits}", String(pack.credits))
                  .replace("{price}", String(pack.price))}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-4 text-[11px] text-white/35">{t.credits.topupNote}</p>
      </div>
    </div>
  );
}
