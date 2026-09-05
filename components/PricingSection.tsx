import PricingSectionClient from "@/components/PricingSectionClient";
import { buildStaticPlanProducts } from "@/lib/pricingCatalog";
import { ensureUsdKrwRate } from "@/lib/currency";
import { syncPlanOfferKrw } from "@/lib/data";

/**
 * Server Component entry for pricing.
 * Visible cards are rebuilt client-side from the active UI locale.
 * The sr-only block keeps a stable Korean domestic + overseas catalog for PG scanners.
 */
export default async function PricingSection({
  layout = "landing",
}: {
  layout?: "landing" | "page";
}) {
  await ensureUsdKrwRate();
  syncPlanOfferKrw();
  const { annual, quarterly, monthly, packs, copy } = buildStaticPlanProducts("kr");

  return (
    <PricingSectionClient
      layout={layout}
      staticHeading={
        <div id="product-catalog" className="sr-only" aria-hidden="false">
          <h2>요금제 상품 정보 (국내)</h2>
          <p>{copy.subtitle}</p>
          <ul>
            {[...quarterly, ...monthly].map((p) => (
              <li key={`catalog-${p.id}`}>
                {p.name} {p.billingLabel}:{" "}
                {p.interval === "monthly" || p.interval === "quarterly"
                  ? p.priceKrw
                  : p.priceUsd}
                {p.perMonthLabel} / {p.priceKrw} — {p.features.join(", ")}
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
    />
  );
}
