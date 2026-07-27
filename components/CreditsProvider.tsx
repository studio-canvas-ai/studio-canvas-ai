"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { FREE_CREDITS, pricingPlanIds, pricingPrices } from "@/lib/data";

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
  pendingPlanId: (typeof pricingPlanIds)[number] | null;
  setShowAuthModal: (open: boolean) => void;
  setShowCreditModal: (open: boolean) => void;
  setShowPaymentModal: (open: boolean) => void;
  consumeCredit: () => boolean;
  topUpCredits: (amount?: number) => void;
  grantFreeCredits: () => void;
  requestSubscribe: (plan: (typeof pricingPlanIds)[number]) => void;
  completePayment: () => void;
};

const CreditsContext = createContext<CreditsContextValue | null>(null);

export function CreditsProvider({ children }: { children: ReactNode }) {
  const [credits, setCredits] = useState(FREE_CREDITS);
  const [maxCredits, setMaxCredits] = useState(FREE_CREDITS);
  const [planId, setPlanId] = useState<PlanId>("free");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingPlanId, setPendingPlanId] = useState<(typeof pricingPlanIds)[number] | null>(
    null
  );

  const isFreePlan = planId === "free";

  const consumeCredit = useCallback(() => {
    if (credits <= 0) {
      setShowCreditModal(true);
      return false;
    }
    setCredits((c) => Math.max(0, c - 1));
    return true;
  }, [credits]);

  const topUpCredits = useCallback((amount = 50) => {
    setCredits((c) => c + amount);
    setMaxCredits((m) => m + amount);
    setShowCreditModal(false);
  }, []);

  const grantFreeCredits = useCallback(() => {
    setIsAuthenticated(true);
    setCredits(FREE_CREDITS);
    setMaxCredits(FREE_CREDITS);
    setPlanId("free");
    setShowAuthModal(false);
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
  }, [pendingPlanId]);

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
      pendingPlanId,
      setShowAuthModal,
      setShowCreditModal,
      setShowPaymentModal,
      consumeCredit,
      topUpCredits,
      grantFreeCredits,
      requestSubscribe,
      completePayment,
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
      pendingPlanId,
      consumeCredit,
      topUpCredits,
      grantFreeCredits,
      requestSubscribe,
      completePayment,
    ]
  );

  return <CreditsContext.Provider value={value}>{children}</CreditsContext.Provider>;
}

export function useCredits() {
  const ctx = useContext(CreditsContext);
  if (!ctx) throw new Error("useCredits must be used within CreditsProvider");
  return ctx;
}

export { pricingPrices };
