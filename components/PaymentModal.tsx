"use client";

import { useState } from "react";
import { CreditCard, Sparkles, X } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useCredits, PLAN_CREDITS } from "@/components/CreditsProvider";
import { pricingPrices, pricingPricesKrw } from "@/lib/data";

export default function PaymentModal() {
  const { t } = useI18n();
  const {
    showPaymentModal,
    setShowPaymentModal,
    pendingPlanId,
    completePayment,
    refreshAccount,
  } = useCredits();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!showPaymentModal || !pendingPlanId) return null;

  const plan = t.pricing.plans[pendingPlanId];
  const price = pricingPrices[pendingPlanId];
  const priceKrw = pricingPricesKrw[pendingPlanId];
  const credits = PLAN_CREDITS[pendingPlanId];

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaying(true);
    setError(null);
    try {
      const createRes = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "subscription", planId: pendingPlanId }),
      });

      if (createRes.status === 401) {
        completePayment();
        return;
      }

      const created = (await createRes.json()) as {
        order?: { id: string; amountKrw: number };
        provider?: string;
        error?: string;
      };

      if (!createRes.ok || !created.order) {
        throw new Error(created.error || "order failed");
      }

      // Toss / PortOne: when PAYMENT_PROVIDER=toss and client SDK is embedded,
      // redirect/widget confirmation hits /api/payments/confirm with paymentKey.
      // Until then, demo confirm credits the ledger when authenticated.
      const confirmRes = await fetch("/api/payments/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: created.order.id, demo: true }),
      });
      if (confirmRes.ok) {
        await refreshAccount();
      }
      completePayment();
    } catch (err) {
      setError(err instanceof Error ? err.message : "payment failed");
      completePayment();
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-navy/80 backdrop-blur-sm"
        aria-label="Close"
        onClick={() => setShowPaymentModal(false)}
      />
      <div className="glass-card relative z-10 w-full max-w-md p-6 sm:p-8">
        <button
          type="button"
          onClick={() => setShowPaymentModal(false)}
          className="absolute top-4 right-4 rounded-lg p-1.5 text-white/40 hover:bg-white/5 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-glow-purple to-glow-emerald">
            <CreditCard className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">{t.payment.title}</h2>
            <p className="text-xs text-white/50">{t.payment.subtitle}</p>
          </div>
        </div>

        <div className="mb-5 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-glow-purple" />
                <span className="font-medium text-white">{plan.name}</span>
              </div>
              <p className="mt-1 text-xs text-white/40">
                {t.payment.creditsIncluded.replace("{count}", String(credits))}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-white">
                {t.payment.amountKrw.replace("{amount}", priceKrw.toLocaleString())}
              </div>
              <div className="text-xs text-white/40">
                ${price}
                {t.pricing.perMonth}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={(e) => void handlePay(e)} className="space-y-3">
          <p className="text-[11px] text-white/45">{t.payment.secureCheckout}</p>
          <p className="text-[11px] text-white/35">{t.payment.simulated}</p>
          {error && <p className="text-xs text-amber-200">{error}</p>}
          <button
            type="submit"
            disabled={paying}
            className="btn-primary w-full py-3 text-sm disabled:opacity-50"
          >
            {paying ? t.payment.processing : t.payment.payWithToss}
          </button>
        </form>
      </div>
    </div>
  );
}
