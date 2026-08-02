"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, Zap } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";
import type { BillingInterval, PricingPlanId } from "@/lib/data";
import type { StaticPlanProduct } from "@/lib/pricingCatalog";
import { isDomesticMarket, readGeoCountryFromDocument } from "@/lib/market";

function PlanCard({
  product,
  onSubscribe,
  popularBadge,
}: {
  product: StaticPlanProduct;
  onSubscribe: (planId: PricingPlanId, interval: BillingInterval) => void;
  popularBadge: string;
}) {
  const highlighted = product.highlighted;
  const isPro = product.planId === "pro" || product.planId === "enterprise";

  return (
    <article
      itemScope
      itemType="https://schema.org/Product"
      data-plan-id={product.planId}
      data-billing={product.interval}
      className={`relative mt-14 rounded-2xl p-[1px] transition-all duration-500 ${
        isPro
          ? "bg-gradient-to-b from-violet-400/50 via-fuchsia-400/30 to-emerald-400/40 shadow-[0_0_35px_rgba(167,139,250,0.22)]"
          : highlighted
            ? "bg-gradient-to-b from-violet-300/25 via-white/12 to-violet-400/12 shadow-[0_0_28px_rgba(139,92,246,0.10)]"
            : "bg-white/[0.12]"
      }`}
    >
      {/* Plan name straddles the top edge; popular sits cleanly above it */}
      <div className="absolute left-1/2 top-0 z-10 w-max max-w-[calc(100%-1rem)] -translate-x-1/2 -translate-y-1/2">
        <div className="relative flex flex-col items-center">
          {highlighted && (
            <span className="absolute bottom-full mb-1.5 inline-flex -rotate-2 items-center gap-1.5 whitespace-nowrap rounded-full bg-gradient-to-r from-glow-purple to-glow-emerald px-3.5 py-1 text-xs font-semibold text-white shadow-glow-sm ring-1 ring-white/25">
              <Zap className="h-3.5 w-3.5 shrink-0 animate-pulse" aria-hidden />
              {popularBadge}
            </span>
          )}
          <span
            className={`inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-semibold tracking-wide text-white shadow-md backdrop-blur-md ${
              isPro
                ? "border-fuchsia-300/45 bg-gradient-to-r from-violet-600/90 via-fuchsia-600/80 to-emerald-600/85 ring-1 ring-white/20"
                : "border-white/30 bg-navy-lighter/95"
            }`}
          >
            {product.name}
          </span>
        </div>
      </div>

      <div
        className={`flex h-full flex-col rounded-2xl px-5 pb-5 pt-7 text-center sm:px-8 sm:pb-8 sm:pt-9 ${
          isPro
            ? "bg-gradient-to-b from-violet-500/[0.18] via-[#1c2438]/95 to-emerald-500/[0.12] backdrop-blur-xl"
            : highlighted
              ? "bg-navy-lighter/70"
              : "bg-white/[0.07] backdrop-blur-xl"
        }`}
      >
        <div className="mb-5">
          <h3 className="text-2xl font-semibold text-white sm:text-[1.65rem]" itemProp="name">
            {product.billingLabel}
          </h3>
          <meta itemProp="description" content={product.billingLabel} />
        </div>

        <div
          className="mb-7"
          itemProp="offers"
          itemScope
          itemType="https://schema.org/Offer"
        >
          <meta itemProp="priceCurrency" content="USD" />
          <meta itemProp="price" content={product.priceUsd.replace("$", "")} />
          <div className="flex items-baseline justify-center gap-1.5">
            <span
              className={`text-5xl font-bold tracking-tight ${
                isPro
                  ? "bg-gradient-to-r from-violet-200 via-white to-emerald-200 bg-clip-text text-transparent"
                  : "text-white"
              }`}
            >
              {product.priceUsd}
            </span>
            <span className="whitespace-nowrap text-base text-white/50">
              {product.perMonthLabel}
            </span>
          </div>
          {product.annualPrepaid && (
            <p className="mt-2 text-sm text-white/45">{product.annualPrepaid}</p>
          )}
          <p className="mt-1.5 text-xs text-white/40">{product.vatNotice}</p>
        </div>

        <ul className="mb-8 flex-1 space-y-3.5">
          {product.features.map((feature) => (
            <li
              key={feature}
              className="flex items-center justify-center gap-2.5 text-center"
            >
              <div
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                  isPro
                    ? "bg-gradient-to-br from-violet-400/35 to-emerald-400/30"
                    : highlighted
                      ? "bg-glow-purple/20"
                      : "bg-white/10"
                }`}
              >
                <Check
                  className={`h-3 w-3 ${
                    isPro
                      ? "text-emerald-300"
                      : highlighted
                        ? "text-glow-purple"
                        : "text-white/55"
                  }`}
                />
              </div>
              <span className="text-[15px] leading-snug text-slate-100">{feature}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => onSubscribe(product.planId, product.interval)}
          className={`w-full rounded-xl py-3.5 text-center text-base font-medium transition ${
            isPro || highlighted
              ? "btn-primary"
              : "inline-flex items-center justify-center border border-white/25 bg-white/10 text-white hover:border-white/40 hover:bg-white/14"
          }`}
        >
          {(isPro || highlighted) && <Zap className="mr-2 h-4 w-4" />}
          {product.ctaLabel}
        </button>
      </div>
    </article>
  );
}

export default function PricingSectionClient({
  annualPlans,
  quarterlyPlans,
  monthlyPlans,
  packCatalog,
  staticHeading,
}: {
  annualPlans: StaticPlanProduct[];
  quarterlyPlans: StaticPlanProduct[];
  monthlyPlans: StaticPlanProduct[];
  packCatalog: ReactNode;
  staticHeading: ReactNode;
}) {
  const { t, locale } = useI18n();
  const { requestSubscribe, setShowTopUpModal } = useCredits();
  const [geoCountry, setGeoCountry] = useState<string | null>(null);
  useEffect(() => {
    setGeoCountry(readGeoCountryFromDocument());
  }, []);
  const hideCreditPacks = isDomesticMarket(locale, geoCountry);
  const isKr = locale === "kr";
  const prepaidInterval: BillingInterval = isKr ? "quarterly" : "annual";
  const [interval, setInterval] = useState<BillingInterval>(prepaidInterval);

  useEffect(() => {
    setInterval(isKr ? "quarterly" : "annual");
  }, [isKr]);

  const prepaidPlans = isKr ? quarterlyPlans : annualPlans;
  const prepaidTabLabel = isKr ? t.pricing.quarterlyBilling : t.pricing.annualBilling;
  const popularBadge = isKr
    ? interval === "quarterly"
      ? t.pricing.monthlyPopular
      : t.pricing.annualRecommended
    : interval === "annual"
      ? t.pricing.annualRecommended
      : t.pricing.monthlyPopular;

  return (
    <section id="pricing" className="section-padding relative" aria-labelledby="pricing-title">
      <div className="ambient-glow bottom-0 left-1/2 h-96 w-96 -translate-x-1/2 bg-glow-purple/10" />

      <div className="relative mx-auto max-w-6xl">
        {staticHeading}

        <div className="mb-10 text-center">
          <span className="text-sm font-medium tracking-widest text-glow-purple uppercase">
            {t.pricing.eyebrow}
          </span>
          <h2 id="pricing-title" className="font-display mt-3 text-3xl font-bold sm:text-4xl">
            {t.pricing.title}
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-white/50 [word-break:keep-all]">
            {t.pricing.subtitle}
          </p>

          <div className="mx-auto mt-7 inline-flex gap-1.5 rounded-full border-2 border-white/40 bg-slate-900/90 p-1.5 shadow-[0_0_0_1px_rgba(255,255,255,0.12)]">
            <button
              type="button"
              onClick={() => setInterval(prepaidInterval)}
              className={`rounded-full px-4 py-2 text-xs transition ${
                interval === prepaidInterval
                  ? "bg-gradient-to-r from-violet-600 to-indigo-600 font-bold text-white shadow-lg"
                  : "bg-slate-800 font-semibold text-slate-200 hover:bg-slate-700"
              }`}
            >
              {prepaidTabLabel}
            </button>
            <button
              type="button"
              onClick={() => setInterval("monthly")}
              className={`rounded-full px-4 py-2 text-xs transition ${
                interval === "monthly"
                  ? "bg-gradient-to-r from-violet-600 to-indigo-600 font-bold text-white shadow-lg"
                  : "bg-slate-800 font-semibold text-slate-200 hover:bg-slate-700"
              }`}
            >
              {t.pricing.monthlyBilling}
            </button>
          </div>
        </div>

        <div
          id={isKr ? "pricing-quarterly" : "pricing-annual"}
          data-billing-group={prepaidInterval}
          className={`grid gap-6 lg:grid-cols-3 ${interval === prepaidInterval ? "" : "hidden"}`}
          aria-hidden={interval !== prepaidInterval}
        >
          {prepaidPlans.map((product) => (
            <PlanCard
              key={product.id}
              product={product}
              onSubscribe={requestSubscribe}
              popularBadge={popularBadge}
            />
          ))}
        </div>

        <div
          id="pricing-monthly"
          data-billing-group="monthly"
          className={`grid gap-6 lg:grid-cols-3 ${interval === "monthly" ? "" : "hidden"}`}
          aria-hidden={interval !== "monthly"}
        >
          {monthlyPlans.map((product) => (
            <PlanCard
              key={product.id}
              product={product}
              onSubscribe={requestSubscribe}
              popularBadge={t.pricing.monthlyPopular}
            />
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-white/35 [word-break:keep-all]">
          {isKr ? t.pricing.upgradeNoticeQuarterly : t.pricing.upgradeNotice}
        </p>
        {isKr && (
          <p className="mx-auto mt-2 max-w-2xl text-center text-[11px] text-white/30 [word-break:keep-all]">
            {t.pricing.quarterlyNoAutoRenewNotice}
          </p>
        )}

        {/* Credit packs: global markets only (hidden for KR locale / domestic PG review). */}
        {!hideCreditPacks && (
          <div className="mt-14 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center sm:p-8">
            <h3 className="text-lg font-semibold text-white">{t.pricing.addonTitle}</h3>
            <p className="mx-auto mt-2 max-w-lg text-sm text-white/45">
              {t.pricing.addonSubtitle}
            </p>
            {packCatalog}
            <button
              type="button"
              onClick={() => setShowTopUpModal(true)}
              className="btn-primary mt-5 px-6 py-2.5 text-sm"
            >
              <Zap className="h-4 w-4" />
              {t.credits.charge}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
