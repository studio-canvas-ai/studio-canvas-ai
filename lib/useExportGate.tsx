"use client";

/**
 * Reusable subscription gate for download / share / secure project I/O.
 */

import { useCallback, useMemo, useState } from "react";
import { useCredits } from "@/components/CreditsProvider";
import PremiumSubscribeModal from "@/components/PremiumSubscribeModal";
import {
  PREMIUM_FEATURE_MESSAGE,
  resolveIsSubscribed,
} from "@/lib/exportAccess";

export function useExportGate() {
  const { planId, isAdmin, unlimitedCredits } = useCredits();
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  const isSubscribed = useMemo(
    () =>
      resolveIsSubscribed({
        planId,
        isAdmin,
        unlimitedCredits,
      }),
    [planId, isAdmin, unlimitedCredits]
  );

  /** Returns true when allowed; otherwise opens premium modal and returns false. */
  const requireSubscription = useCallback((): boolean => {
    if (isSubscribed) return true;
    setShowPremiumModal(true);
    return false;
  }, [isSubscribed]);

  const premiumModal = (
    <PremiumSubscribeModal
      open={showPremiumModal}
      onClose={() => setShowPremiumModal(false)}
      message={PREMIUM_FEATURE_MESSAGE}
    />
  );

  return {
    isSubscribed,
    requireSubscription,
    showPremiumModal,
    setShowPremiumModal,
    premiumModal,
  };
}
