"use client";

import { useState } from "react";
import { X, Zap, Crown } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";
import { CREDIT_PACKS, creditPackAmount } from "@/lib/data";
import { formatUsdWithKrw } from "@/lib/currency";
import { shouldShowKrw } from "@/lib/paymentRouting";

export default function CreditTopUpModal() {
  const { t, locale } = useI18n();
  const { showTopUpModal, setShowTopUpModal, planId, refreshAccount } = useCredits();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSubscriber = planId !== "free";
  const showKrw = shouldShowKrw(locale);

  if (!showTopUpModal) return null;

  const purchase = async (packId: (typeof CREDIT_PACKS)[number]["id"]) => {
    setBusy(true);
    setError(null);
    try {
      const createRes = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "credit_pack", packId, locale }),
      });
      if (createRes.status === 401) {
        setShowTopUpModal(false);
        return;
      }
      const created = (await createRes.json()) as {
        order?: { id: string };
        checkoutUrl?: string | null;
        demoAllowed?: boolean;
        error?: string;
      };
      if (!createRes.ok || !created.order) {
        throw new Error(created.error || "order failed");
      }
      if (created.checkoutUrl) {
        window.location.href = created.checkoutUrl;
        return;
      }
      if (created.demoAllowed) {
        const confirmRes = await fetch("/api/payments/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: created.order.id, demo: true }),
        });
        if (!confirmRes.ok) throw new Error("confirm failed");
        await refreshAccount();
        setShowTopUpModal(false);
        return;
      }
      throw new Error("checkout unavailable");
    } catch (err) {
      setError(err instanceof Error ? err.message : "payment failed");
    } finally {
      setBusy(false);
    }
  };

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
            const price = formatUsdWithKrw(pack.price, showKrw);
            const label = showKrw && price.krwLabel
              ? `${credits} credits · ${price.usdLabel} (${price.krwLabel})`
              : t.credits.packLabel
                  .replace("{credits}", String(credits))
                  .replace("{price}", String(pack.price));
            return (
              <button
                key={pack.id}
                type="button"
                disabled={busy}
                onClick={() => void purchase(pack.id)}
                className="btn-secondary flex w-full items-center justify-between py-3 text-sm disabled:opacity-50"
              >
                <span className="inline-flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-300" />
                  {label}
                </span>
              </button>
            );
          })}
        </div>
        {error && <p className="mt-3 text-xs text-amber-200">{error}</p>}
        <p className="mt-4 text-[11px] text-white/35">{t.payment.vatIncluded}</p>
      </div>
    </div>
  );
}
