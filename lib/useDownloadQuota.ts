"use client";

/**
 * Shared FHD / 4K remaining quota labels + spend helper for all download buttons.
 */

import { useCallback, useMemo } from "react";
import { useCredits } from "@/components/CreditsProvider";
import { useI18n } from "@/components/I18nProvider";
import { getPlanUsageLimits } from "@/lib/planQuotas";

export type DownloadQualityKind = "standard" | "high";

export function useDownloadQuota() {
  const { t } = useI18n();
  const { planId, billingInterval, planUsage, consumeDownloadQuota } =
    useCredits();

  const limits = useMemo(
    () => getPlanUsageLimits(planId, billingInterval),
    [planId, billingInterval]
  );

  const fhdRemaining = planUsage?.fhdRemaining ?? limits.fhd;
  const uhd4kRemaining = planUsage?.uhd4kRemaining ?? limits.uhd4k;

  const standardLabel = t.gallery.worksDownloadStandardCount.replace(
    "{n}",
    String(fhdRemaining)
  );
  const highLabel = t.gallery.worksDownloadHighCount.replace(
    "{n}",
    String(uhd4kRemaining)
  );

  const labelFor = useCallback(
    (quality: DownloadQualityKind) =>
      quality === "high" ? highLabel : standardLabel,
    [highLabel, standardLabel]
  );

  const remainingFor = useCallback(
    (quality: DownloadQualityKind) =>
      quality === "high" ? uhd4kRemaining : fhdRemaining,
    [fhdRemaining, uhd4kRemaining]
  );

  /** Spend one FHD/4K download. Returns false when empty or API rejects. */
  const spendForQuality = useCallback(
    async (quality: DownloadQualityKind) => {
      const kind = quality === "high" ? "uhd4k" : "fhd";
      if (remainingFor(quality) < 1) {
        return { ok: false as const, remaining: 0 };
      }
      return consumeDownloadQuota(kind);
    },
    [consumeDownloadQuota, remainingFor]
  );

  return {
    fhdRemaining,
    uhd4kRemaining,
    standardLabel,
    highLabel,
    labelFor,
    remainingFor,
    canDownloadStandard: fhdRemaining >= 1,
    canDownloadHigh: uhd4kRemaining >= 1,
    quotaEmptyMessage: t.gallery.worksDownloadQuotaEmpty,
    spendForQuality,
  };
}
