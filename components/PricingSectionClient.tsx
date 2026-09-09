"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, Zap } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";
import type { BillingInterval, PricingPlanId } from "@/lib/data";
import {
  buildStaticPlanProducts,
  type StaticPlanProduct,
} from "@/lib/pricingCatalog";
import { isDomesticLocale } from "@/lib/market";
import { shouldShowKrw } from "@/lib/paymentRouting";

/** Split feature copy into title vs muted detail for visual hierarchy. */
function splitFeatureLine(feature: string): {
  primary: string;
  secondary: string | null;
} {
  const creditUse = feature.match(
    /^(.+?\((?:\d+\s*(?:크레딧|credits?))\))\s*[:：]\s*(.+)$/i
  );
  if (creditUse) {
    return { primary: creditUse[1]!.trim(), secondary: creditUse[2]!.trim() };
  }
  const pool = feature.match(
    /^(.+?(?:크레딧|credits)\s*\/\s*[^\(]+)\s*(\(.+\))$/i
  );
  if (pool) {
    return { primary: pool[1]!.trim(), secondary: pool[2]!.trim() };
  }
  const colon = feature.match(/^([^:：]{2,40})\s*[:：]\s*(.+)$/);
  if (colon) {
    return { primary: colon[1]!.trim(), secondary: colon[2]!.trim() };
  }
  return { primary: feature, secondary: null };
}

function PlanCard({
  product,
  onSubscribe,
  popularBadge,
  showKrw,
  compact = false,
}: {
  product: StaticPlanProduct;
  onSubscribe: (planId: PricingPlanId, interval: BillingInterval) => void;
  popularBadge: string;
  showKrw: boolean;
  /** Tighter density for /pricing viewport fit */
  compact?: boolean;
}) {
  const highlighted = product.highlighted;
  const isPro = product.planId === "pro" || product.planId === "enterprise";
  const useKrwPrice =
    showKrw && (product.interval === "monthly" || product.interval === "quarterly");
  const displayPrice = useKrwPrice ? product.priceKrw : product.priceUsd;
  const priceCurrency = useKrwPrice ? "KRW" : "USD";
  const schemaPrice = useKrwPrice
    ? String(product.totalKrw)
    : product.priceUsd.replace("$", "");

  return (
    <article
      itemScope
      itemType="https://schema.org/Product"
      data-plan-id={product.planId}
      data-billing={product.interval}
      data-currency={priceCurrency}
      className={`relative flex min-h-0 flex-col rounded-2xl p-[1px] transition-all duration-500 ${
        isPro
          ? "bg-gradient-to-b from-violet-400/50 via-fuchsia-400/30 to-emerald-400/40 shadow-[0_0_35px_rgba(167,139,250,0.22)]"
          : highlighted
            ? "bg-gradient-to-b from-violet-300/25 via-white/12 to-violet-400/12 shadow-[0_0_28px_rgba(139,92,246,0.10)]"
            : "bg-white/[0.12]"
      }`}
    >
      {/* Name chip sits on the top edge; popular badge sits beside it (no extra row). */}
      <div className="absolute left-1/2 top-0 z-10 flex w-max max-w-[calc(100%-0.75rem)] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-1">
        <span
          className={`inline-flex items-center rounded-full border font-semibold tracking-wide text-white shadow-md backdrop-blur-md ${
            compact ? "px-2.5 py-0.5 text-[11px] sm:px-3 sm:text-xs" : "px-4 py-1.5 text-sm"
          } ${
            isPro
              ? "border-fuchsia-300/45 bg-gradient-to-r from-violet-600/90 via-fuchsia-600/80 to-emerald-600/85 ring-1 ring-white/20"
              : "border-white/30 bg-navy-lighter/95"
          }`}
        >
          {product.name}
        </span>
        {highlighted && (
          <span
            className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-gradient-to-r from-glow-purple to-glow-emerald font-semibold text-white shadow-glow-sm ring-1 ring-white/25 ${
              compact
                ? "px-2 py-0.5 text-[10px] sm:text-[11px]"
                : "-rotate-2 px-3.5 py-1 text-xs"
            }`}
          >
            <Zap
              className={`shrink-0 animate-pulse ${compact ? "h-2.5 w-2.5" : "h-3.5 w-3.5"}`}
              aria-hidden
            />
            {popularBadge}
          </span>
        )}
      </div>

      <div
        className={`flex min-h-0 flex-1 flex-col rounded-2xl text-center ${
          compact
            ? "px-4 pb-4 pt-7 sm:px-6 sm:pb-5 sm:pt-7"
            : "px-6 pb-6 pt-8 sm:px-9 sm:pb-9 sm:pt-10"
        } ${
          isPro
            ? "bg-gradient-to-b from-violet-500/[0.18] via-[#1c2438]/95 to-emerald-500/[0.12] backdrop-blur-xl"
            : highlighted
              ? "bg-navy-lighter/70"
              : "bg-white/[0.07] backdrop-blur-xl"
        }`}
      >
        <div className={compact ? "mb-2" : "mb-5"}>
          <h3
            className={`font-semibold text-white ${
              compact ? "text-base sm:text-lg" : "text-2xl sm:text-[1.65rem]"
            }`}
            itemProp="name"
          >
            {product.billingLabel}
          </h3>
          <meta itemProp="description" content={product.billingLabel} />
        </div>

        <div
          className={compact ? "mb-3" : "mb-7"}
          itemProp="offers"
          itemScope
          itemType="https://schema.org/Offer"
        >
          <meta itemProp="priceCurrency" content={priceCurrency} />
          <meta itemProp="price" content={schemaPrice} />
          <div className="flex items-baseline justify-center gap-1">
            <span
              className={`font-bold tracking-tight ${
                compact ? "text-3xl sm:text-[2.15rem]" : "text-5xl"
              } ${
                isPro
                  ? "bg-gradient-to-r from-violet-200 via-white to-emerald-200 bg-clip-text text-transparent"
                  : "text-white"
              }`}
            >
              {displayPrice}
            </span>
            <span
              className={`whitespace-nowrap text-white/50 ${
                compact ? "text-xs sm:text-sm" : "text-base"
              }`}
            >
              {product.perMonthLabel}
            </span>
          </div>
          {product.annualPrepaid && (
            <p
              className={`mt-1.5 text-white/45 ${
                compact ? "text-[10px] leading-snug sm:text-[11px]" : "mt-2 text-sm"
              }`}
            >
              {product.annualPrepaid}
            </p>
          )}
          <p
            className={`text-white/40 ${
              compact ? "mt-1 text-[10px] leading-snug sm:text-[11px]" : "mt-1.5 text-xs"
            }`}
          >
            {product.vatNotice}
          </p>
        </div>

        <ul
          className={`min-h-0 flex-1 text-left ${
            compact ? "mb-3.5 space-y-1.5" : "mb-7 space-y-2"
          }`}
        >
          {product.features.map((feature) => {
            const { primary, secondary } = splitFeatureLine(feature);
            return (
              <li
                key={feature}
                className={`flex items-start text-left ${
                  compact ? "gap-2" : "gap-2.5"
                }`}
              >
                <div
                  className={`mt-0.5 flex shrink-0 items-center justify-center rounded-full ${
                    compact ? "h-4 w-4" : "h-5 w-5"
                  } ${
                    isPro
                      ? "bg-gradient-to-br from-violet-400/35 to-emerald-400/30"
                      : highlighted
                        ? "bg-glow-purple/20"
                        : "bg-white/10"
                  }`}
                >
                  <Check
                    className={`${compact ? "h-2.5 w-2.5" : "h-2.5 w-2.5"} ${
                      isPro
                        ? "text-emerald-300"
                        : highlighted
                          ? "text-glow-purple"
                          : "text-white/50"
                    }`}
                  />
                </div>
                <p
                  className={`min-w-0 flex-1 text-left leading-snug tracking-tight ${
                    compact
                      ? "text-[11px] sm:text-xs"
                      : "text-xs sm:text-[13px]"
                  }`}
                >
                  <span className="font-medium text-white">{primary}</span>
                  {secondary ? (
                    <span className="font-normal text-cyan-300">
                      {secondary.startsWith("(") ? " " : ": "}
                      {secondary}
                    </span>
                  ) : null}
                </p>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={() => onSubscribe(product.planId, product.interval)}
          className={`btn-primary mt-auto inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl text-center font-semibold transition-all duration-300 ${
            compact ? "py-2.5 text-sm" : "py-3.5 text-base"
          } ${
            isPro
              ? "shadow-[0_4px_24px_rgba(167,139,250,0.42)] hover:shadow-[0_6px_32px_rgba(167,139,250,0.52)]"
              : highlighted
                ? "shadow-[0_4px_20px_rgba(139,92,246,0.32)] hover:shadow-[0_6px_28px_rgba(139,92,246,0.42)]"
                : "shadow-[0_4px_16px_rgba(139,92,246,0.24)] hover:shadow-[0_6px_24px_rgba(139,92,246,0.34)]"
          }`}
        >
          {(isPro || highlighted) && (
            <Zap
              className={`shrink-0 ${compact ? "h-3.5 w-3.5" : "h-4 w-4"}`}
              aria-hidden
            />
          )}
          {product.ctaLabel}
        </button>
      </div>
    </article>
  );
}

export default function PricingSectionClient({
  staticHeading,
  layout = "landing",
}: {
  /** SSR-only PortOne / scanner catalog (always Korean domestic + overseas blocks). */
  staticHeading: ReactNode;
  /** `page` = dedicated /pricing route under fixed navbar (tighter top). */
  layout?: "landing" | "page";
}) {
  const { t, locale, isReady } = useI18n();
  const { requestSubscribe, setShowTopUpModal } = useCredits();

  const isKr = isDomesticLocale(locale);
  const showKrw = shouldShowKrw(locale);
  const hideCreditPacks = isKr;
  const prepaidInterval: BillingInterval = isKr ? "quarterly" : "annual";
  // Default to prepaid pass (KR: 3-month / global: annual), not monthly.
  const [interval, setInterval] = useState<BillingInterval>(prepaidInterval);

  const catalog = useMemo(() => buildStaticPlanProducts(locale), [locale]);
  const { annual: annualPlans, quarterly: quarterlyPlans, monthly: monthlyPlans, packs } =
    catalog;

  // Keep default on the prepaid tab when language/market flips.
  useEffect(() => {
    if (!isReady) return;
    setInterval(prepaidInterval);
  }, [isKr, isReady, prepaidInterval]);

  const prepaidPlans = isKr ? quarterlyPlans : annualPlans;
  const prepaidTabLabel = isKr ? t.pricing.quarterlyBilling : t.pricing.annualBilling;
  const popularBadge =
    interval === "monthly"
      ? t.pricing.monthlyPopular
      : isKr
        ? t.pricing.monthlyPopular
        : t.pricing.annualRecommended;

  const isPage = layout === "page";
  const gridClass = isPage
    ? "grid min-h-0 flex-1 items-stretch gap-5 pt-2 sm:gap-6 lg:grid-cols-3"
    : "grid gap-7 pt-7 lg:grid-cols-3";

  if (!isReady) {
    return (
      <section id="pricing" className="section-padding relative" aria-busy="true">
        <div className="mx-auto max-w-6xl py-24 text-center text-sm text-white/40">
          …
        </div>
      </section>
    );
  }

  return (
    <section
      id="pricing"
      key={locale}
      className={
        isPage
          ? // Fill the viewport under the fixed navbar so three cards read at a glance.
            "relative flex min-h-svh flex-col px-4 pb-3 pt-12 sm:px-6 sm:pb-4 md:pt-14 lg:px-8 lg:pt-16 lg:pb-4 xl:px-10"
          : "section-padding relative"
      }
      aria-labelledby="pricing-title"
      data-market={isKr ? "domestic" : "global"}
      data-locale={locale}
      data-pricing-layout={layout}
    >
      <div className="ambient-glow bottom-0 left-1/2 h-96 w-96 -translate-x-1/2 bg-glow-purple/10" />

      <div
        className={`relative mx-auto flex w-full max-w-7xl flex-1 flex-col ${
          isPage ? "pt-0" : "pt-3 sm:pt-4"
        }`}
      >
        {staticHeading}

        <div className={`text-center ${isPage ? "mb-2.5 sm:mb-3" : "mb-6"}`}>
          {/* Eyebrow duplicates nav label — keep only on landing marketing blocks */}
          {!isPage && (
            <span className="text-sm font-medium tracking-widest text-glow-purple uppercase">
              {t.pricing.eyebrow}
            </span>
          )}
          <h2
            id="pricing-title"
            className={`font-display font-bold ${
              isPage
                ? "text-xl leading-tight sm:text-2xl"
                : "mt-2 text-3xl sm:text-4xl"
            }`}
          >
            {t.pricing.title}
          </h2>
          <p
            className={`mx-auto max-w-2xl text-white/45 [word-break:keep-all] ${
              isPage
                ? "mt-1 text-xs leading-snug sm:mt-1.5 sm:text-sm"
                : "mt-3 text-base"
            }`}
          >
            {t.pricing.subtitle}
          </p>

          {/* Tab 1: 3-month (KR) / Annual (intl) · Tab 2: Monthly */}
          <div
            className={`mx-auto inline-flex gap-1 rounded-full border-2 border-white/40 bg-slate-900/90 shadow-[0_0_0_1px_rgba(255,255,255,0.12)] ${
              isPage ? "mt-2.5 p-1 sm:mt-3" : "mt-5 gap-1.5 p-1.5"
            }`}
          >
            <button
              type="button"
              onClick={() => setInterval(prepaidInterval)}
              className={`rounded-full transition ${
                isPage ? "px-3 py-1.5 text-[11px] sm:px-3.5 sm:text-xs" : "px-4 py-2 text-xs"
              } ${
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
              className={`rounded-full transition ${
                isPage ? "px-3 py-1.5 text-[11px] sm:px-3.5 sm:text-xs" : "px-4 py-2 text-xs"
              } ${
                interval === "monthly"
                  ? "bg-gradient-to-r from-violet-600 to-indigo-600 font-bold text-white shadow-lg"
                  : "bg-slate-800 font-semibold text-slate-200 hover:bg-slate-700"
              }`}
            >
              {t.pricing.monthlyBilling}
            </button>
          </div>

          <p
            className={`mx-auto max-w-3xl text-center font-medium text-cyan-200/85 [word-break:keep-all] ${
              isPage
                ? "mt-2.5 text-[11px] leading-snug sm:mt-3 sm:text-xs"
                : "mt-4 text-sm leading-snug"
            }`}
          >
            {t.pricing.creditPoolSharedNotice}
          </p>
        </div>

        <div
          id={isKr ? "pricing-quarterly" : "pricing-annual"}
          data-billing-group={prepaidInterval}
          data-market={isKr ? "domestic" : "global"}
          className={`${gridClass} ${interval === prepaidInterval ? "" : "hidden"}`}
          aria-hidden={interval !== prepaidInterval}
        >
          {prepaidPlans.map((product) => (
            <PlanCard
              key={`${locale}-${product.id}`}
              product={product}
              onSubscribe={requestSubscribe}
              popularBadge={popularBadge}
              showKrw={showKrw}
              compact={isPage}
            />
          ))}
        </div>

        <div
          id="pricing-monthly"
          data-billing-group="monthly"
          data-market={isKr ? "domestic" : "global"}
          className={`${gridClass} ${interval === "monthly" ? "" : "hidden"}`}
          aria-hidden={interval !== "monthly"}
        >
          {monthlyPlans.map((product) => (
            <PlanCard
              key={`${locale}-${product.id}`}
              product={product}
              onSubscribe={requestSubscribe}
              popularBadge={t.pricing.monthlyPopular}
              showKrw={showKrw}
              compact={isPage}
            />
          ))}
        </div>

        <div
          className={`shrink-0 space-y-1.5 text-center ${isPage ? "mt-3 sm:mt-4" : "mt-8 space-y-2"}`}
        >
          {interval === "monthly" ? (
            <>
              <p
                className={`mx-auto max-w-3xl font-medium text-pink-200/80 [word-break:keep-all] ${
                  isPage ? "text-[11px] leading-snug sm:text-xs" : "text-xs"
                }`}
              >
                {isKr
                  ? t.pricing.upgradeNoticeMonthly
                  : t.pricing.upgradeNotice}
              </p>
              {isKr && (
                <p
                  className={`mx-auto max-w-3xl font-medium text-pink-200/80 [word-break:keep-all] ${
                    isPage ? "text-[11px] leading-snug sm:text-xs" : "text-xs"
                  }`}
                >
                  {t.pricing.monthlyRecurringKcpNotice}
                </p>
              )}
            </>
          ) : (
            <>
              <p
                className={`mx-auto max-w-3xl font-medium text-pink-200/80 [word-break:keep-all] ${
                  isPage ? "text-[11px] leading-snug sm:text-xs" : "text-xs"
                }`}
              >
                {isKr
                  ? t.pricing.upgradeNoticeQuarterly
                  : t.pricing.upgradeNotice}
              </p>
              {isKr && (
                <p
                  className={`mx-auto max-w-3xl font-medium text-pink-200/80 [word-break:keep-all] ${
                    isPage ? "text-[11px] leading-snug sm:text-xs" : "text-xs"
                  }`}
                >
                  {t.pricing.quarterlyNoAutoRenewNotice}
                </p>
              )}
            </>
          )}
        </div>
        {!hideCreditPacks && (
          <div
            className={`rounded-2xl border border-white/10 bg-white/[0.03] text-center ${
              isPage ? "mt-6 p-4 sm:p-5" : "mt-14 p-6 sm:p-8"
            }`}
          >
            <h3 className="text-lg font-semibold text-white">{t.pricing.addonTitle}</h3>
            <p className="mx-auto mt-2 max-w-lg text-sm text-white/45">
              {t.pricing.addonSubtitle}
            </p>
            <ul
              id="credit-pack-catalog"
              className="mx-auto mt-4 max-w-md space-y-2 text-left text-sm text-zinc-200"
            >
              {packs.map((pack) => (
                <li
                  key={`${locale}-${pack.id}`}
                  className="flex justify-between gap-3 border-b border-white/10 py-1.5"
                >
                  <span>
                    {`${pack.name} — free ${pack.freeCredits} / subscriber ${pack.subscriberCredits} credits`}
                  </span>
                  <span className="shrink-0 font-semibold">{pack.priceUsd}</span>
                </li>
              ))}
            </ul>
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
