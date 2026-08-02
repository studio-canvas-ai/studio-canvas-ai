import PricingSectionClient from "@/components/PricingSectionClient";
import { buildStaticPlanProducts } from "@/lib/pricingCatalog";
import { ensureUsdKrwRate } from "@/lib/currency";
import { syncPlanOfferKrw } from "@/lib/data";

/**
 * Server Component entry for pricing.
 * Domestic (KR/KCP) catalog: quarterly + monthly only.
 * Credit packs and annual plans stay in a separate overseas-only block for global scanners.
 */
export default async function PricingSection() {
  await ensureUsdKrwRate();
  syncPlanOfferKrw();
  const { annual, quarterly, monthly, packs, copy } = buildStaticPlanProducts();

  return (
    <PricingSectionClient
      annualPlans={annual}
      quarterlyPlans={quarterly}
      monthlyPlans={monthly}
      staticHeading={
        <div id="product-catalog" className="sr-only" aria-hidden="false">
          <h2>요금제 상품 정보 (국내)</h2>
          <p>{copy.subtitle}</p>
          <ul>
            {[...quarterly, ...monthly].map((p) => (
              <li key={`catalog-${p.id}`}>
                {p.name} {p.billingLabel}: {p.priceUsd}
                {p.perMonthLabel} / {p.totalUsd} — {p.features.join(", ")}
              </li>
            ))}
          </ul>
          <div id="overseas-product-catalog" data-market="global">
            <h2>Overseas plans &amp; credit packs (global markets only)</h2>
            <ul>
              {annual.map((p) => (
                <li key={`catalog-overseas-${p.id}`}>
                  {p.name} {p.billingLabel}: {p.priceUsd}
                  {p.perMonthLabel} / {p.totalUsd} — {p.features.join(", ")}
                </li>
              ))}
              {packs.map((pack) => (
                <li key={`catalog-overseas-${pack.id}`}>
                  {pack.name}: {pack.priceUsd} — free {pack.freeCredits} / subscriber{" "}
                  {pack.subscriberCredits} credits
                </li>
              ))}
            </ul>
          </div>
        </div>
      }
      packCatalog={
        <ul
          id="credit-pack-catalog"
          className="mx-auto mt-4 max-w-md space-y-2 text-left text-sm text-zinc-200"
        >
          {packs.map((pack) => (
            <li key={pack.id} className="flex justify-between gap-3 border-b border-white/10 py-1.5">
              <span>
                {pack.name} — 무료 {pack.freeCredits} / 구독 {pack.subscriberCredits} 크레딧
              </span>
              <span className="shrink-0 font-semibold">{pack.priceUsd}</span>
            </li>
          ))}
        </ul>
      }
    />
  );
}
