"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import {
  CREDIT_PACKS,
  type BillingInterval,
  FREE_CREDITS,
  getPlanOffer,
  RETOUCH_FREE_PER_CYCLE,
  pricingPlanIds,
} from "@/lib/data";
import {
  evaluateRetouchRequest,
  type PortraitRetouchState,
  type RetouchAttemptResult,
} from "@/lib/retouchPolicy";
import {
  getAccountMeta,
  patchAccountMeta,
  recalculateGalleryRetentionOnCancel,
  type PlanId,
} from "@/lib/faceProfiles";
import {
  clearPendingCheckout,
  readPendingCheckout,
  savePendingCheckout,
} from "@/lib/pendingCheckout";

export type { PlanId } from "@/lib/faceProfiles";

export { PLAN_CREDITS } from "@/lib/data";

export type SocialProviderId =
  | "google"
  | "microsoft"
  | "facebook"
  | "instagram"
  | "kakao"
  | "naver";

type PromoWalletView = {
  remainingCredits: number;
  expiresAt: number;
  codeSuffix: string;
};

type CreditsContextValue = {
  credits: number;
  maxCredits: number;
  isFreePlan: boolean;
  isAuthenticated: boolean;
  planId: PlanId;
  billingInterval: BillingInterval;
  showAuthModal: boolean;
  showCreditModal: boolean;
  showPaymentModal: boolean;
  showTopUpModal: boolean;
  showReturnModal: boolean;
  showPromoModal: boolean;
  promoWallet: PromoWalletView | null;
  pendingPlanId: (typeof pricingPlanIds)[number] | null;
  pendingBillingInterval: BillingInterval;
  socialProviders: SocialProviderId[];
  socialProvidersLoaded: boolean;
  setShowAuthModal: (open: boolean) => void;
  setShowCreditModal: (open: boolean) => void;
  setShowPaymentModal: (open: boolean) => void;
  setShowTopUpModal: (open: boolean) => void;
  setShowReturnModal: (open: boolean) => void;
  setShowPromoModal: (open: boolean) => void;
  openAuthModal: (opts?: { clearPending?: boolean }) => void;
  consumeCredit: (amount?: number) => boolean;
  topUpCredits: (amount?: number) => void;
  purchaseCreditPack: (packId: (typeof CREDIT_PACKS)[number]["id"]) => Promise<void>;
  grantFreeCredits: () => void;
  refreshAccount: () => Promise<void>;
  requestSubscribe: (
    plan: (typeof pricingPlanIds)[number],
    interval?: BillingInterval
  ) => void;
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
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {
    // fall through to local date
  }
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function CreditsProvider({ children }: { children: ReactNode }) {
  const [credits, setCredits] = useState(FREE_CREDITS);
  const [maxCredits, setMaxCredits] = useState(FREE_CREDITS);
  const [planId, setPlanId] = useState<PlanId>("free");
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("monthly");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoWallet, setPromoWallet] = useState<PromoWalletView | null>(null);
  const [pendingPlanId, setPendingPlanId] = useState<(typeof pricingPlanIds)[number] | null>(
    null
  );
  const [pendingBillingInterval, setPendingBillingInterval] =
    useState<BillingInterval>("annual");
  const [socialProviders, setSocialProviders] = useState<SocialProviderId[]>([]);
  const [socialProvidersLoaded, setSocialProvidersLoaded] = useState(false);
  const [portraits, setPortraits] = useState<Record<string, PortraitRetouchState>>({});
  const [dailyRetouchCount, setDailyRetouchCount] = useState(0);
  const [dailyKey, setDailyKey] = useState(todayKey);
  const recentRetouchTs = useRef<number[]>([]);
  const pendingResumeDone = useRef(false);

  const isFreePlan = planId === "free";

  useEffect(() => {
    const meta = getAccountMeta();
    if (meta.hadPaidPlan || meta.lastLoginAt) setIsAuthenticated(true);
    if (meta.planId && meta.planId !== "free") {
      setPlanId(meta.planId);
      if (meta.planId === "enterprise") setBillingInterval("annual");
      const creditCount =
        meta.planId === "enterprise"
          ? getPlanOffer("enterprise", "annual").credits
          : getPlanOffer(
              meta.planId,
              meta.planId === "standard" ? "monthly" : "monthly"
            ).credits;
      setCredits(creditCount);
      setMaxCredits(creditCount);
      setIsAuthenticated(true);
    } else if (meta.planId === "free") {
      setPlanId("free");
    }
    const stored = readPendingCheckout();
    if (stored) {
      setPendingPlanId(stored.planId);
      setPendingBillingInterval(stored.interval);
    }
    void refreshServerState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warm client FX cache from server (non-blocking; never breaks UI).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/fx");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { rate?: number };
        if (typeof data.rate === "number" && data.rate > 0) {
          const { setCachedUsdKrwRate } = await import("@/lib/currency");
          setCachedUsdKrwRate(data.rate);
        }
      } catch {
        // keep env/default fallback
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshServerState = useCallback(async () => {
    try {
      const res = await fetch("/api/account/me");
      if (!res.ok) throw new Error("account unavailable");
      const data = (await res.json()) as {
        authenticated?: boolean;
        providers?: SocialProviderId[];
        user?: {
          credits: number;
          maxCredits: number;
          planId: PlanId;
          billingInterval?: BillingInterval | null;
        } | null;
      };
      if (Array.isArray(data.providers)) {
        setSocialProviders(data.providers);
        setSocialProvidersLoaded(true);
      }
      if (data.authenticated && data.user) {
        setIsAuthenticated(true);
        setCredits(data.user.credits);
        setMaxCredits(data.user.maxCredits);
        setPlanId(data.user.planId);
        setBillingInterval(data.user.billingInterval ?? "monthly");
        patchAccountMeta({
          lastLoginAt: Date.now(),
          planId: data.user.planId,
        });
        setPromoWallet(null);
        if (!pendingResumeDone.current) {
          const stored = readPendingCheckout();
          if (stored) {
            pendingResumeDone.current = true;
            setPendingPlanId(stored.planId);
            setPendingBillingInterval(stored.interval);
            setShowAuthModal(false);
            setShowPaymentModal(true);
          }
        }
        return;
      }
    } catch {
      setSocialProvidersLoaded(true);
      /* try anonymous promo wallet */
    }

    try {
      const response = await fetch("/api/promotions/me", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as {
        active: boolean;
        wallet: PromoWalletView | null;
      };
      setPromoWallet(data.active ? data.wallet : null);
      if (data.active && data.wallet) {
        setCredits(data.wallet.remainingCredits);
        setMaxCredits(data.wallet.remainingCredits);
      }
    } catch {
      /* retain local free balance */
    }
  }, []);

  const refreshAccount = refreshServerState;

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

  const purchaseCreditPack = useCallback(
    async (packId: (typeof CREDIT_PACKS)[number]["id"]) => {
      await refreshServerState();
      setShowCreditModal(false);
      setShowTopUpModal(false);
    },
    [refreshServerState]
  );

  const grantFreeCredits = useCallback(() => {
    setIsAuthenticated(true);
    setCredits(FREE_CREDITS);
    setMaxCredits(FREE_CREDITS);
    setPlanId("free");
    setShowAuthModal(false);
    patchAccountMeta({ lastLoginAt: Date.now(), planId: "free" });
  }, []);

  const openAuthModal = useCallback((opts?: { clearPending?: boolean }) => {
    if (opts?.clearPending !== false) {
      setPendingPlanId(null);
      clearPendingCheckout();
    }
    setShowAuthModal(true);
  }, []);

  const requestSubscribe = useCallback(
    (
      plan: (typeof pricingPlanIds)[number],
      interval: BillingInterval = "annual"
    ) => {
      setPendingPlanId(plan);
      setPendingBillingInterval(interval);
      savePendingCheckout({ planId: plan, interval });
      if (!isAuthenticated) {
        setShowAuthModal(true);
        return;
      }
      setShowPaymentModal(true);
    },
    [isAuthenticated]
  );

  const completePayment = useCallback(async () => {
    setShowPaymentModal(false);
    setPendingPlanId(null);
    clearPendingCheckout();
    await refreshServerState();
  }, [refreshServerState]);

  const cancelSubscription = useCallback(async () => {
    try {
      await fetch("/api/payments/subscription/cancel", { method: "POST" });
      await refreshServerState();
    } catch {
      /* best effort */
    }
    const meta = getAccountMeta();
    const lastPaid = planId !== "free" ? planId : meta.lastPaidPlan;
    const cancelledAt = Date.now();
    setPlanId("free");
    patchAccountMeta({
      cancelledAt,
      hadPaidPlan: true,
      planId: "free",
      lastPaidPlan: lastPaid,
    });
    recalculateGalleryRetentionOnCancel({
      planId: "free",
      cancelledAt,
      lastPaidPlan: lastPaid,
    });
  }, [planId, refreshServerState]);

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
      billingInterval,
      showAuthModal,
      showCreditModal,
      showPaymentModal,
      showTopUpModal,
      showReturnModal,
      showPromoModal,
      promoWallet,
      pendingPlanId,
      pendingBillingInterval,
      socialProviders,
      socialProvidersLoaded,
      setShowAuthModal,
      setShowCreditModal,
      setShowPaymentModal,
      setShowTopUpModal,
      setShowReturnModal,
      setShowPromoModal,
      openAuthModal,
      consumeCredit,
      topUpCredits,
      purchaseCreditPack,
      grantFreeCredits,
      refreshAccount,
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
      billingInterval,
      showAuthModal,
      showCreditModal,
      showPaymentModal,
      showTopUpModal,
      showReturnModal,
      showPromoModal,
      promoWallet,
      pendingPlanId,
      pendingBillingInterval,
      socialProviders,
      socialProvidersLoaded,
      openAuthModal,
      consumeCredit,
      topUpCredits,
      purchaseCreditPack,
      grantFreeCredits,
      refreshAccount,
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
