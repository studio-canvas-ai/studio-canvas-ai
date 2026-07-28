"use client";

import { Check, Sparkles, Zap } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";
import { pricingPlanIds, pricingPrices } from "@/lib/data";

export default function PricingSection() {
  const { t } = useI18n();
  const { requestSubscribe, setShowTopUpModal } = useCredits();

  return (
    <section id="pricing" className="section-padding relative">
      <div className="ambient-glow bottom-0 left-1/2 h-96 w-96 -translate-x-1/2 bg-glow-purple/10" />

      <div className="relative mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <span className="text-sm font-medium tracking-widest text-glow-purple uppercase">
            {t.pricing.eyebrow}
          </span>
          <h2 className="font-display mt-3 text-3xl font-bold sm:text-4xl">{t.pricing.title}</h2>
          <p className="mx-auto mt-4 max-w-xl text-white/50">{t.pricing.subtitle}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {pricingPlanIds.map((planId) => {
            const plan = t.pricing.plans[planId];
            const highlighted = planId === "standard";
            const price = pricingPrices[planId];

            return (
              <div
                key={planId}
                className={`relative rounded-2xl p-[1px] transition-all duration-500 ${
                  highlighted
                    ? "bg-gradient-to-b from-glow-purple/60 via-glow-emerald/30 to-glow-purple/20 shadow-glow"
                    : "bg-white/[0.08]"
                }`}
              >
                <div
                  className={`flex h-full flex-col rounded-2xl p-5 sm:p-8 ${
                    highlighted
                      ? "bg-navy-light"
                      : "glass-card !rounded-2xl !border-0 !shadow-none"
                  }`}
                >
                  {highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-gradient-to-r from-glow-purple to-glow-emerald px-3 py-1 text-[10px] font-semibold text-white shadow-glow-sm sm:px-4 sm:text-xs">
                        <Sparkles className="h-3 w-3 shrink-0" />
                        {t.pricing.mostPopular}
                      </span>
                    </div>
                  )}

                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-white/40">{plan.description}</p>
                  </div>

                  <div className="mb-8">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold sm:text-4xl">${price}</span>
                      <span className="text-sm text-white/40">{t.pricing.perMonth}</span>
                    </div>
                  </div>

                  <ul className="mb-8 flex-1 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                            highlighted ? "bg-glow-purple/20" : "bg-white/5"
                          }`}
                        >
                          <Check
                            className={`h-3 w-3 ${
                              highlighted ? "text-glow-purple" : "text-white/50"
                            }`}
                          />
                        </div>
                        <span className="text-sm leading-snug text-slate-200">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => requestSubscribe(planId)}
                    className={`w-full rounded-xl py-3 text-center text-sm font-medium transition-all duration-300 ${
                      highlighted
                        ? "btn-primary"
                        : "inline-flex items-center justify-center border border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10"
                    }`}
                  >
                    {highlighted ? (
                      <span className="flex items-center justify-center gap-2">
                        <Zap className="h-4 w-4 shrink-0" />
                        <span className="truncate">{t.pricing.getStarted}</span>
                      </span>
                    ) : (
                      <span className="truncate">{t.pricing.selectPlan}</span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-sm font-medium text-white/55">
          {t.pricing.commercialNotice}
        </p>
        <p className="mt-3 text-center text-xs text-white/30">{t.pricing.disclaimer}</p>

        <div className="mt-14 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center sm:p-8">
          <h3 className="text-lg font-semibold text-white">{t.pricing.addonTitle}</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm text-white/45">{t.pricing.addonSubtitle}</p>
          <button
            type="button"
            onClick={() => setShowTopUpModal(true)}
            className="btn-primary mt-5 px-6 py-2.5 text-sm"
          >
            <Zap className="h-4 w-4" />
            {t.credits.charge}
          </button>
        </div>
      </div>
    </section>
  );
}
