"use client";

import { useState } from "react";
import { CalendarClock, CreditCard, Sparkles, X } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";
import { getPlanOffer, isPrepaidPass } from "@/lib/data";
import { formatUsd } from "@/lib/currency";
import { resolveCheckoutRegion } from "@/lib/paymentRouting";

export default function PaymentModal() {
  const { t, locale } = useI18n();
  const {
    showPaymentModal,
    setShowPaymentModal,
    pendingPlanId,
    pendingBillingInterval,
    refreshAccount,
  } = useCredits();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [termsAgreed, setTermsAgreed] = useState(false);

  if (!showPaymentModal || !pendingPlanId) return null;

  const offer = getPlanOffer(pendingPlanId, pendingBillingInterval);
  const planName =
    pendingPlanId === "enterprise"
      ? "Enterprise"
      : pendingPlanId === "standard"
        ? "Standard"
        : pendingPlanId === "pro"
          ? "Pro"
          : "Starter";

  const region = resolveCheckoutRegion(locale);
  const priceLabel = formatUsd(offer.totalUsd);
  const isPrepaid = isPrepaidPass(pendingBillingInterval);

  const startCheckout = async (mode: "domestic" | "stripe" | "demo") => {
    if (!termsAgreed) {
      setError(t.payment.termsRequired);
      return;
    }
    setPaying(true);
    setError(null);
    try {
      const createRes = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "subscription",
          planId: pendingPlanId,
          billingInterval: pendingBillingInterval,
          locale: mode === "domestic" ? "kr" : locale,
        }),
      });

      if (createRes.status === 401) {
        setShowPaymentModal(false);
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

      if (created.demoAllowed && mode !== "stripe") {
        const confirmRes = await fetch("/api/payments/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: created.order.id, demo: true }),
        });
        if (!confirmRes.ok) throw new Error("demo confirm failed");
        await refreshAccount();
        setShowPaymentModal(false);
        return;
      }

      throw new Error("checkout unavailable");
    } catch (err) {
      setError(err instanceof Error ? err.message : "payment failed");
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
                <span className="font-medium text-white">{planName}</span>
              </div>
              <p className="mt-1 text-xs text-white/40">
                {(isPrepaid
                  ? t.payment.creditsIncludedAnnual
                  : t.payment.creditsIncluded
                ).replace("{count}", String(offer.credits))}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-white">{priceLabel}</div>
              <div className="text-xs text-white/40">{t.payment.vatIncluded}</div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {isPrepaid ? (
            <div className="rounded-xl border border-amber-300/30 bg-amber-400/[0.08] p-3">
              <div className="flex items-start gap-2.5">
                <CalendarClock
                  className="mt-0.5 h-4 w-4 shrink-0 text-amber-200"
                  aria-hidden
                />
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold leading-relaxed text-amber-100">
                    {pendingBillingInterval === "quarterly"
                      ? t.payment.quarterlyOneTimeNotice
                      : t.payment.annualOneTimeNotice}
                  </p>
                  <p className="text-[11px] leading-relaxed text-zinc-200">
                    {pendingBillingInterval === "quarterly"
                      ? t.payment.quarterlyExpiryNotice
                      : t.payment.annualExpiryNotice}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-zinc-300">{t.payment.autoRenewNotice}</p>
          )}
          <p className="text-[11px] text-white/35">{t.payment.refundNotice}</p>
          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <input
              type="checkbox"
              checked={termsAgreed}
              onChange={(e) => setTermsAgreed(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-xs text-white/70">{t.payment.termsLabel}</span>
          </label>
          <p className="text-[11px] text-white/45">{t.payment.secureCheckout}</p>
          {error && <p className="text-xs text-amber-200">{error}</p>}

          {region === "domestic" ? (
            <button
              type="button"
              disabled={paying || !termsAgreed}
              onClick={() => void startCheckout("domestic")}
              className="btn-primary w-full py-3 text-sm disabled:opacity-50"
            >
              {paying ? t.payment.processing : t.payment.payWithToss}
            </button>
          ) : (
            <button
              type="button"
              disabled={paying || !termsAgreed}
              onClick={() => void startCheckout("stripe")}
              className="btn-primary w-full py-3 text-sm disabled:opacity-50"
            >
              {paying ? t.payment.redirecting : t.payment.payWithStripe}
            </button>
          )}

          {region === "domestic" && (
            <button
              type="button"
              disabled={paying || !termsAgreed}
              onClick={() => void startCheckout("stripe")}
              className="btn-secondary w-full py-2.5 text-sm disabled:opacity-50"
            >
              {t.payment.payWithStripe}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
