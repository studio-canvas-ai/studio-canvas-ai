"use client";

import { useState } from "react";
import { CreditCard, Sparkles, X } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useCredits, PLAN_CREDITS } from "@/components/CreditsProvider";
import { pricingPrices } from "@/lib/data";

export default function PaymentModal() {
  const { t } = useI18n();
  const {
    showPaymentModal,
    setShowPaymentModal,
    pendingPlanId,
    completePayment,
  } = useCredits();
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [name, setName] = useState("");
  const [paying, setPaying] = useState(false);

  if (!showPaymentModal || !pendingPlanId) return null;

  const plan = t.pricing.plans[pendingPlanId];
  const price = pricingPrices[pendingPlanId];
  const credits = PLAN_CREDITS[pendingPlanId];

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    setPaying(true);
    setTimeout(() => {
      completePayment();
      setPaying(false);
      setCardNumber("");
      setExpiry("");
      setCvc("");
      setName("");
    }, 1200);
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
              <div className="text-2xl font-bold text-white">${price}</div>
              <div className="text-xs text-white/40">{t.pricing.perMonth}</div>
            </div>
          </div>
        </div>

        <form onSubmit={handlePay} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-white/50">{t.payment.cardName}</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-glow-purple/40"
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/50">{t.payment.cardNumber}</label>
            <input
              required
              inputMode="numeric"
              maxLength={19}
              value={cardNumber}
              onChange={(e) =>
                setCardNumber(
                  e.target.value
                    .replace(/\D/g, "")
                    .slice(0, 16)
                    .replace(/(\d{4})(?=\d)/g, "$1 ")
                )
              }
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm tracking-wider text-white outline-none focus:border-glow-purple/40"
              placeholder="4242 4242 4242 4242"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-white/50">{t.payment.expiry}</label>
              <input
                required
                maxLength={5}
                value={expiry}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setExpiry(raw.length > 2 ? `${raw.slice(0, 2)}/${raw.slice(2)}` : raw);
                }}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-glow-purple/40"
                placeholder="MM/YY"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/50">{t.payment.cvc}</label>
              <input
                required
                inputMode="numeric"
                maxLength={4}
                value={cvc}
                onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-glow-purple/40"
                placeholder="123"
              />
            </div>
          </div>
          <p className="text-[11px] text-white/35">{t.payment.simulated}</p>
          <button
            type="submit"
            disabled={paying}
            className="btn-primary w-full py-3 text-sm disabled:opacity-50"
          >
            {paying
              ? t.payment.processing
              : t.payment.payNow.replace("{price}", String(price))}
          </button>
        </form>
      </div>
    </div>
  );
}
