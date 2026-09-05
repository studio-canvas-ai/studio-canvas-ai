"use client";

/**
 * Shared credit-pool remaining labels + spend helper for download buttons.
 */

import { useCallback, useMemo } from "react";
import { useCredits } from "@/components/CreditsProvider";
import { useI18n } from "@/components/I18nProvider";
import { getPlanUsageLimits } from "@/lib/planQuotas";
import { FEATURE_CREDIT_COST } from "@/lib/featureCreditCosts";

export type DownloadQualityKind = "standard" | "high" | "ultra";

export function useDownloadQuota() {
  const { t } = useI18n();
  const { planId, billingInterval, planUsage, consumeDownloadQuota } =
    useCredits();

  const limits = useMemo(
    () => getPlanUsageLimits(planId, billingInterval),
    [planId, billingInterval]
  );

  // Unified credit pool lives in fhdRemaining (server snapshot).
  const poolRemaining = planUsage?.fhdRemaining ?? 0;
  const usageReady = planUsage != null;

  const standardLabel = t.gallery.worksDownloadStandardCount.replace(
    "{n}",
    usageReady ? String(poolRemaining) : "—"
  );
  const highLabel = t.gallery.worksDownloadHighCount.replace(
    "{n}",
    usageReady ? String(poolRemaining) : "—"
  );

  const labelFor = useCallback(
    (quality: DownloadQualityKind) =>
      quality === "high" || quality === "ultra" ? highLabel : standardLabel,
    [highLabel, standardLabel]
  );

  const costFor = useCallback((quality: DownloadQualityKind) => {
    if (quality === "ultra") return FEATURE_CREDIT_COST.ultraDownload;
    if (quality === "high") return FEATURE_CREDIT_COST.hdDownload;
    return FEATURE_CREDIT_COST.webDownload;
  }, []);

  const remainingFor = useCallback(
    (_quality: DownloadQualityKind) => poolRemaining,
    [poolRemaining]
  );

  /** Spend credit-pool amount for quality. Returns false when empty or API rejects. */
  const spendForQuality = useCallback(
    async (quality: DownloadQualityKind) => {
      const cost = costFor(quality);
      if (usageReady && poolRemaining < cost) {
        return { ok: false as const, remaining: poolRemaining };
      }
      const kind = quality === "standard" ? "fhd" : "uhd4k";
      return consumeDownloadQuota(kind, {
        amount: cost,
        action:
          quality === "ultra"
            ? "ultraDownload"
            : quality === "high"
              ? "hdDownload"
              : "webDownload",
      });
    },
    [consumeDownloadQuota, costFor, poolRemaining, usageReady]
  );

  return {
    fhdRemaining: poolRemaining,
    uhd4kRemaining: poolRemaining,
    poolRemaining,
    standardLabel,
    highLabel,
    labelFor,
    remainingFor,
    costFor,
    canDownloadStandard: usageReady && poolRemaining >= FEATURE_CREDIT_COST.webDownload,
    canDownloadHigh: usageReady && poolRemaining >= FEATURE_CREDIT_COST.hdDownload,
    canDownloadUltra: usageReady && poolRemaining >= FEATURE_CREDIT_COST.ultraDownload,
    quotaEmptyMessage: t.gallery.worksDownloadQuotaEmpty,
    spendForQuality,
    /** True once /api/account/me (or a spend) has hydrated usage. */
    usageReady,
    limits,
  };
}
