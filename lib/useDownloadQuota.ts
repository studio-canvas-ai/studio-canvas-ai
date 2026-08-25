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

  // Prefer server snapshot; never invent "full plan" remaining while usage is loading.
  const fhdRemaining = planUsage?.fhdRemaining ?? 0;
  const uhd4kRemaining = planUsage?.uhd4kRemaining ?? 0;
  const usageReady = planUsage != null;

  const standardLabel = t.gallery.worksDownloadStandardCount.replace(
    "{n}",
    usageReady ? String(fhdRemaining) : "—"
  );
  const highLabel = t.gallery.worksDownloadHighCount.replace(
    "{n}",
    usageReady ? String(uhd4kRemaining) : "—"
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
      if (usageReady && remainingFor(quality) < 1) {
        return { ok: false as const, remaining: 0 };
      }
      return consumeDownloadQuota(kind);
    },
    [consumeDownloadQuota, remainingFor, usageReady]
  );

  return {
    fhdRemaining,
    uhd4kRemaining,
    standardLabel,
    highLabel,
    labelFor,
    remainingFor,
    canDownloadStandard: usageReady && fhdRemaining >= 1,
    canDownloadHigh: usageReady && uhd4kRemaining >= 1,
    quotaEmptyMessage: t.gallery.worksDownloadQuotaEmpty,
    spendForQuality,
    /** True once /api/account/me (or a spend) has hydrated usage. */
    usageReady,
    limits,
  };
}
