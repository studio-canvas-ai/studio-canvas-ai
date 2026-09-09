import type { BillingInterval, PricingPlanId } from "@/lib/data";
import { creditPoolForPlan } from "@/lib/featureCreditCosts";

/** Period caps for pricing UI and download/storage enforcement. */
export type QuotaMode = "max" | "plus";

export type QuotaCap = {
  n: number;
  mode: QuotaMode;
};

export type PlanLicense = "personal" | "commercial" | "commercialFull";

export type PlanQuotaDisplay = {
  fhd: QuotaCap;
  uhd4k: QuotaCap;
  trainSlots: QuotaCap;
  gallery: QuotaCap;
  trainPhotos: QuotaCap;
  generalPhotos: QuotaCap;
  license: PlanLicense;
};

const max = (n: number): QuotaCap => ({ n, mode: "max" });
const plus = (n: number): QuotaCap => ({ n, mode: "plus" });

const MONTHLY: Record<"starter" | "standard" | "pro", PlanQuotaDisplay> = {
  starter: {
    fhd: max(200),
    uhd4k: max(15),
    trainSlots: max(1),
    gallery: max(100),
    trainPhotos: max(100),
    generalPhotos: max(200),
    license: "commercial",
  },
  standard: {
    fhd: max(600),
    uhd4k: max(50),
    trainSlots: max(5),
    gallery: max(500),
    trainPhotos: max(500),
    generalPhotos: max(1_000),
    license: "commercial",
  },
  pro: {
    fhd: max(2_000),
    uhd4k: max(200),
    trainSlots: max(10),
    gallery: plus(2_000),
    trainPhotos: plus(2_000),
    generalPhotos: plus(5_000),
    license: "commercialFull",
  },
};

const QUARTERLY: Record<"starter" | "standard" | "pro", PlanQuotaDisplay> = {
  starter: {
    fhd: max(700),
    uhd4k: max(50),
    trainSlots: max(4),
    gallery: max(150),
    trainPhotos: max(150),
    generalPhotos: max(300),
    license: "commercial",
  },
  standard: {
    fhd: max(2_000),
    uhd4k: max(180),
    trainSlots: max(18),
    gallery: max(800),
    trainPhotos: max(800),
    generalPhotos: max(1_500),
    license: "commercial",
  },
  pro: {
    fhd: max(7_000),
    uhd4k: max(700),
    trainSlots: max(35),
    gallery: plus(3_000),
    trainPhotos: plus(3_000),
    generalPhotos: plus(8_000),
    license: "commercialFull",
  },
};

const ANNUAL: Record<"starter" | "standard" | "pro", PlanQuotaDisplay> = {
  starter: {
    fhd: max(2_500),
    uhd4k: max(200),
    trainSlots: max(15),
    gallery: max(1_200),
    trainPhotos: max(1_200),
    generalPhotos: max(2_500),
    license: "personal",
  },
  standard: {
    fhd: max(7_500),
    uhd4k: max(700),
    trainSlots: max(60),
    gallery: max(6_000),
    trainPhotos: max(6_000),
    generalPhotos: max(12_000),
    license: "commercial",
  },
  pro: {
    fhd: max(25_000),
    uhd4k: max(2_500),
    trainSlots: max(120),
    gallery: plus(25_000),
    trainPhotos: plus(25_000),
    generalPhotos: plus(60_000),
    license: "commercialFull",
  },
};

export function getPlanQuotaDisplay(
  planId: PricingPlanId,
  interval: BillingInterval
): PlanQuotaDisplay {
  const key = planId === "enterprise" ? "pro" : planId;
  if (key !== "starter" && key !== "standard" && key !== "pro") {
    return MONTHLY.starter;
  }
  if (interval === "quarterly") return QUARTERLY[key];
  if (interval === "annual") return ANNUAL[key];
  return MONTHLY[key];
}

export type PlanUsageLimits = {
  fhd: number;
  uhd4k: number;
  gallery: number;
};

export type PlanUsageSnapshot = {
  fhdRemaining: number;
  fhdLimit: number;
  uhd4kRemaining: number;
  uhd4kLimit: number;
  galleryLimit: number;
};

/** Numeric period caps used for enforcement (plus-mode uses the listed N). */
export function getPlanUsageLimits(
  planId: string | null | undefined,
  interval: BillingInterval | null | undefined
): PlanUsageLimits {
  const plan = (planId || "free").toLowerCase();
  if (plan === "free" || plan === "") {
    return { fhd: 0, uhd4k: 0, gallery: 0 };
  }
  const billing: BillingInterval =
    interval === "quarterly" || interval === "annual" || interval === "monthly"
      ? interval
      : "monthly";
  const key: PricingPlanId =
    plan === "enterprise" || plan === "pro"
      ? "pro"
      : plan === "standard"
        ? "standard"
        : plan === "starter"
          ? "starter"
          : "starter";
  if (plan !== "starter" && plan !== "standard" && plan !== "pro" && plan !== "enterprise") {
    return { fhd: 0, uhd4k: 0, gallery: 0 };
  }
  const q = getPlanQuotaDisplay(key, billing);
  const creditPool = creditPoolForPlan(key, billing);
  return {
    // Monthly / 3-month: fhdRemaining is the unified credit pool (pricing catalog).
    fhd: creditPool ?? q.fhd.n,
    uhd4k: q.uhd4k.n,
    gallery: q.gallery.n,
  };
}
