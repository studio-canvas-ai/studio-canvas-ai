"use client";

import { useState } from "react";
import { Check, Zap } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";
import {
  PLAN_OFFERS,
  type BillingInterval,
  type PlanOffer,
} from "@/lib/data";
import type { Translations } from "@/lib/i18n/types";

function planName(offer: PlanOffer) {
  if (offer.planId === "enterprise") return "Enterprise";
  if (offer.planId === "standard") return "Standard";
  if (offer.planId === "pro") return "Pro";
  return "Starter";
}

function fill(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template
  );
}

function features(offer: PlanOffer, copy: Translations["pricing"], ko: boolean) {
  const period = offer.interval === "annual" ? (ko ? "연" : "Yearly") : ko ? "월" : "Monthly";
  const list = [
    `${fill(copy.generationBenefit, {
      period,
      credits: offer.credits.toLocaleString(),
    })}${offer.interval === "annual" && offer.highlighted ? " 🚀" : ""}`,
    fill(copy.photoBenefit, { count: offer.profileSlots }),
    offer.resolution === "4K"
      ? copy.fourKBenefit
      : copy.fhdBenefit,
  ];
  if (offer.fastGeneration)
    list.push(copy.fastBenefit);
  if (offer.commercialUse)
    list.push(copy.commercialBenefit);
  if (offer.permanentStorage)
    list.push(copy.permanentBenefit);
  if (offer.interval === "annual" || offer.planId !== "starter")
    list.push(copy.watermarkBenefit);
  return list;
}

export default function PricingSection() {
  const { t, locale } = useI18n();
  const { requestSubscribe, setShowTopUpModal } = useCredits();
  const [interval, setInterval] = useState<BillingInterval>("annual");
  const ko = locale === "kr";
  const offers = PLAN_OFFERS[interval];

  return (
    <section id="pricing" className="section-padding relative">
      <div className="ambient-glow bottom-0 left-1/2 h-96 w-96 -translate-x-1/2 bg-glow-purple/10" />

      <div className="relative mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <span className="text-sm font-medium tracking-widest text-glow-purple uppercase">
            {t.pricing.eyebrow}
          </span>
          <h2 className="font-display mt-3 text-3xl font-bold sm:text-4xl">
            {t.pricing.title}
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-white/50 [word-break:keep-all]">
            {t.pricing.subtitle}
          </p>

          <div className="mx-auto mt-7 inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1">
            <button
              type="button"
              onClick={() => setInterval("annual")}
              className={`rounded-full px-4 py-2 text-xs font-medium transition ${
                interval === "annual"
                  ? "bg-gradient-to-r from-glow-purple to-glow-emerald text-white shadow-glow-sm"
                  : "text-white/45 hover:text-white/70"
              }`}
            >
              {t.pricing.annualBilling}
            </button>
            <button
              type="button"
              onClick={() => setInterval("monthly")}
              className={`rounded-full px-4 py-2 text-xs font-medium transition ${
                interval === "monthly"
                  ? "bg-white/10 text-white"
                  : "text-white/45 hover:text-white/70"
              }`}
            >
              {t.pricing.monthlyBilling}
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {offers.map((offer) => {
            const highlighted = offer.highlighted;
            const proCard = offer.interval === "monthly" && offer.planId === "pro";
            return (
              <div
                key={`${offer.interval}-${offer.planId}`}
                className={`relative rounded-2xl p-[1px] transition-all duration-500 ${
                  highlighted
                    ? "bg-gradient-to-b from-glow-purple/70 via-glow-emerald/35 to-glow-purple/20 shadow-glow"
                    : proCard
                      ? "bg-gradient-to-b from-indigo-400/35 via-violet-500/25 to-purple-500/15"
                      : "bg-white/[0.08]"
                }`}
              >
                <div
                  className={`flex h-full flex-col rounded-2xl p-5 sm:p-8 ${
                    highlighted
                      ? "bg-navy-light"
                      : proCard
                        ? "bg-gradient-to-br from-indigo-950/95 via-violet-950/80 to-purple-950/75"
                        : "glass-card !rounded-2xl !border-0 !shadow-none"
                  }`}
                >
                  {highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-gradient-to-r from-glow-purple to-glow-emerald px-4 py-1 text-xs font-semibold text-white shadow-glow-sm">
                        {offer.interval === "annual"
                          ? t.pricing.annualRecommended
                          : t.pricing.monthlyPopular}
                      </span>
                    </div>
                  )}

                  <div className="mb-5">
                    <h3 className="text-xl font-semibold text-white">{planName(offer)}</h3>
                    <p className="mt-1 text-sm text-white/40">
                      {offer.interval === "annual"
                        ? t.pricing.annualSubscription
                        : t.pricing.monthlySubscription}
                    </p>
                  </div>

                  <div className="mb-7">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">${offer.monthlyUsd}</span>
                      <span className="text-sm text-white/45">{t.pricing.perMonth}</span>
                    </div>
                    {offer.interval === "annual" && (
                      <p className="mt-2 text-xs text-white/40">
                        {fill(t.pricing.annualPrepaid, { total: offer.totalUsd })}
                      </p>
                    )}
                  </div>

                  <ul className="mb-8 flex-1 space-y-3">
                    {features(offer, t.pricing, ko).map((feature) => (
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
                    onClick={() => requestSubscribe(offer.planId, interval)}
                    className={`w-full rounded-xl py-3 text-center text-sm font-medium transition ${
                      highlighted
                        ? "btn-primary"
                        : "inline-flex items-center justify-center border border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10"
                    }`}
                  >
                    {highlighted && <Zap className="mr-2 h-4 w-4" />}
                    {highlighted ? t.pricing.getStarted : t.pricing.selectPlan}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-white/35">
          {t.pricing.upgradeNotice}
        </p>

        <div className="mt-14 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center sm:p-8">
          <h3 className="text-lg font-semibold text-white">{t.pricing.addonTitle}</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm text-white/45">
            {t.pricing.addonSubtitle}
          </p>
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
