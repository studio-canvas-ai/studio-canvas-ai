"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  CREDIT_PACKS,
  FREE_CREDITS,
  RETOUCH_FREE_PER_CYCLE,
  pricingPlanIds,
} from "@/lib/data";
import {
  evaluateRetouchRequest,
  type PortraitRetouchState,
  type RetouchAttemptResult,
} from "@/lib/retouchPolicy";
import { patchAccountMeta } from "@/lib/faceProfiles";

export type PlanId = "free" | (typeof pricingPlanIds)[number];

export const PLAN_CREDITS: Record<(typeof pricingPlanIds)[number], number> = {
  starter: 30,
  standard: 80,
  pro: 200,
};

type CreditsContextValue = {
  credits: number;
  maxCredits: number;
  isFreePlan: boolean;
  isAuthenticated: boolean;
  planId: PlanId;
  showAuthModal: boolean;
  showCreditModal: boolean;
  showPaymentModal: boolean;
  showTopUpModal: boolean;
  showReturnModal: boolean;
  pendingPlanId: (typeof pricingPlanIds)[number] | null;
  setShowAuthModal: (open: boolean) => void;
  setShowCreditModal: (open: boolean) => void;
  setShowPaymentModal: (open: boolean) => void;
  setShowTopUpModal: (open: boolean) => void;
  setShowReturnModal: (open: boolean) => void;
  consumeCredit: (amount?: number) => boolean;
  topUpCredits: (amount?: number) => void;
  purchaseCreditPack: (packId: (typeof CREDIT_PACKS)[number]["id"]) => void;
  grantFreeCredits: () => void;
  requestSubscribe: (plan: (typeof pricingPlanIds)[number]) => void;
  completePayment: () => void;
  cancelSubscription: () => void;
  registerPortrait: (portraitId: string, createdAt?: number) => PortraitRetouchState;
  getPortraitRetouch: (portraitId: string) => PortraitRetouchState | null;
  requestRetouch: (
    portraitId: string,
    mode?: "retouch" | "regenerate"
  ) => RetouchAttemptResult;
  dailyRetouchCount: number;
};

const CreditsContext = createContext<CreditsContextValue | null>(null);

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function CreditsProvider({ children }: { children: ReactNode }) {
  const [credits, setCredits] = useState(FREE_CREDITS);
  const [maxCredits, setMaxCredits] = useState(FREE_CREDITS);
  const [planId, setPlanId] = useState<PlanId>("free");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [pendingPlanId, setPendingPlanId] = useState<(typeof pricingPlanIds)[number] | null>(
    null
  );
  const [portraits, setPortraits] = useState<Record<string, PortraitRetouchState>>({});
  const [dailyRetouchCount, setDailyRetouchCount] = useState(0);
  const [dailyKey, setDailyKey] = useState(todayKey);
  const recentRetouchTs = useRef<number[]>([]);

  const isFreePlan = planId === "free";

  const ensureDailyCounter = useCallback(() => {
    const key = todayKey();
    if (key !== dailyKey) {
      setDailyKey(key);
      setDailyRetouchCount(0);
      return 0;
    }
    return dailyRetouchCount;
  }, [dailyKey, dailyRetouchCount]);

  const consumeCredit = useCallback(
    (amount = 1) => {
      if (credits < amount) {
        setShowCreditModal(true);
        return false;
      }
      setCredits((c) => Math.max(0, Math.round((c - amount) * 10) / 10));
      return true;
    },
    [credits]
  );

  const topUpCredits = useCallback((amount = 50) => {
    setCredits((c) => c + amount);
    setMaxCredits((m) => m + amount);
    setShowCreditModal(false);
    setShowTopUpModal(false);
  }, []);

  const purchaseCreditPack = useCallback((packId: (typeof CREDIT_PACKS)[number]["id"]) => {
    const pack = CREDIT_PACKS.find((p) => p.id === packId);
    if (!pack) return;
    setCredits((c) => c + pack.credits);
    setMaxCredits((m) => Math.max(m, pack.credits));
    setShowCreditModal(false);
    setShowTopUpModal(false);
  }, []);

  const grantFreeCredits = useCallback(() => {
    setIsAuthenticated(true);
    setCredits(FREE_CREDITS);
    setMaxCredits(FREE_CREDITS);
    setPlanId("free");
    setShowAuthModal(false);
    patchAccountMeta({ lastLoginAt: Date.now() });
  }, []);

  const requestSubscribe = useCallback(
    (plan: (typeof pricingPlanIds)[number]) => {
      setPendingPlanId(plan);
      if (!isAuthenticated) {
        setShowAuthModal(true);
        return;
      }
      setShowPaymentModal(true);
    },
    [isAuthenticated]
  );

  const completePayment = useCallback(() => {
    if (!pendingPlanId) return;
    const creditCount = PLAN_CREDITS[pendingPlanId];
    setPlanId(pendingPlanId);
    setCredits(creditCount);
    setMaxCredits(creditCount);
    setIsAuthenticated(true);
    setShowPaymentModal(false);
    setPendingPlanId(null);
    patchAccountMeta({
      hadPaidPlan: true,
      cancelledAt: undefined,
      lastLoginAt: Date.now(),
    });
  }, [pendingPlanId]);

  const cancelSubscription = useCallback(() => {
    setPlanId("free");
    patchAccountMeta({ cancelledAt: Date.now(), hadPaidPlan: true });
  }, []);

  const registerPortrait = useCallback((portraitId: string, createdAt = Date.now()) => {
    const state: PortraitRetouchState = {
      portraitId,
      createdAt,
      freeRemaining: RETOUCH_FREE_PER_CYCLE,
      nextDayEntryCharged: false,
    };
    setPortraits((prev) => ({ ...prev, [portraitId]: state }));
    return state;
  }, []);

  const getPortraitRetouch = useCallback(
    (portraitId: string) => portraits[portraitId] ?? null,
    [portraits]
  );

  const requestRetouch = useCallback(
    (
      portraitId: string,
      mode: "retouch" | "regenerate" = "retouch"
    ): RetouchAttemptResult => {
      const currentDaily = ensureDailyCounter();
      const existing = portraits[portraitId];
      const createdAt = existing?.createdAt ?? Date.now();

      const result = evaluateRetouchRequest({
        state: existing ?? null,
        portraitId,
        createdAt,
        credits,
        dailyRetouchCount: currentDaily,
        recentTimestamps: recentRetouchTs.current,
        mode,
      });

      if (result.nextTimestamps) {
        recentRetouchTs.current = result.nextTimestamps;
      }

      if (!result.ok) {
        if (result.reason === "insufficient_credits") {
          setShowCreditModal(true);
        }
        return result;
      }

      if (result.cost > 0) {
        setCredits((c) => Math.max(0, Math.round((c - result.cost) * 10) / 10));
      }
      setPortraits((prev) => ({ ...prev, [portraitId]: result.state }));
      setDailyRetouchCount((n) => n + 1);
      return result;
    },
    [credits, ensureDailyCounter, portraits]
  );

  const value = useMemo(
    () => ({
      credits,
      maxCredits,
      isFreePlan,
      isAuthenticated,
      planId,
      showAuthModal,
      showCreditModal,
      showPaymentModal,
      showTopUpModal,
      showReturnModal,
      pendingPlanId,
      setShowAuthModal,
      setShowCreditModal,
      setShowPaymentModal,
      setShowTopUpModal,
      setShowReturnModal,
      consumeCredit,
      topUpCredits,
      purchaseCreditPack,
      grantFreeCredits,
      requestSubscribe,
      completePayment,
      cancelSubscription,
      registerPortrait,
      getPortraitRetouch,
      requestRetouch,
      dailyRetouchCount,
    }),
    [
      credits,
      maxCredits,
      isFreePlan,
      isAuthenticated,
      planId,
      showAuthModal,
      showCreditModal,
      showPaymentModal,
      showTopUpModal,
      showReturnModal,
      pendingPlanId,
      consumeCredit,
      topUpCredits,
      purchaseCreditPack,
      grantFreeCredits,
      requestSubscribe,
      completePayment,
      cancelSubscription,
      registerPortrait,
      getPortraitRetouch,
      requestRetouch,
      dailyRetouchCount,
    ]
  );

  return <CreditsContext.Provider value={value}>{children}</CreditsContext.Provider>;
}

export function useCredits() {
  const ctx = useContext(CreditsContext);
  if (!ctx) throw new Error("useCredits must be used within CreditsProvider");
  return ctx;
}
