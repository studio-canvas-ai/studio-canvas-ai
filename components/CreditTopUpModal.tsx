"use client";

import { useState } from "react";
import { X, Zap, Crown } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";
import { CREDIT_PACKS, creditPackAmount } from "@/lib/data";

export default function CreditTopUpModal() {
  const { t } = useI18n();
  const { showTopUpModal, setShowTopUpModal, purchaseCreditPack, planId } = useCredits();
  const [busy, setBusy] = useState(false);
  const isSubscriber = planId !== "free";

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
        <p className="mb-3 text-sm text-white/50">{t.credits.topupDesc}</p>
        {isSubscriber && (
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-amber-400/35 bg-amber-400/10 px-3 py-1 text-[11px] font-medium text-amber-100">
            <Crown className="h-3.5 w-3.5" />
            {t.credits.subscriberBadge}
          </div>
        )}
        <div className="flex flex-col gap-2">
          {CREDIT_PACKS.map((pack) => {
            const credits = creditPackAmount(pack, isSubscriber);
            return (
              <button
                key={pack.id}
                type="button"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void (async () => {
                    try {
                      const createRes = await fetch("/api/payments/create", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ kind: "credit_pack", packId: pack.id }),
                      });
                      if (createRes.ok) {
                        const created = (await createRes.json()) as { order?: { id: string } };
                        if (created.order?.id) {
                          await fetch("/api/payments/confirm", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ orderId: created.order.id, demo: true }),
                          });
                        }
                      }
                    } catch {
                      /* local fallback */
                    }
                    purchaseCreditPack(pack.id);
                    setBusy(false);
                  })();
                }}
                className="btn-secondary flex w-full items-center justify-between py-3 text-sm disabled:opacity-50"
              >
                <span className="inline-flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-300" />
                  {t.credits.packLabel
                    .replace("{credits}", String(credits))
                    .replace("{price}", String(pack.price))}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-[11px] text-white/35">{t.credits.topupNote}</p>
      </div>
    </div>
  );
}
