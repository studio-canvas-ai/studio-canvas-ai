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
import { isGuestCheckoutAllowedClient } from "@/lib/checkoutPolicy";
import {
  hasUnlimitedCredits,
  ADMIN_TEST_CREDITS,
  isPrivilegedAdminEmail,
} from "@/lib/unlimitedAccount";
import { shouldApplyBrandWatermark } from "@/lib/watermarkPolicy";
import { stashAuthErrorForModal } from "@/lib/supabase/oauthErrors";

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

export type AuthUserProfile = {
  id: string | null;
  email: string | null;
  name: string | null;
  image: string | null;
};

type CreditsContextValue = {
  credits: number;
  maxCredits: number;
  /** Designated admin/test accounts: infinite bypass disabled (999 + refill at 0). */
  unlimitedCredits: boolean;
  /** Label for navbar / badges (`∞` only if unlimitedCredits is true). */
  creditsLabel: string;
  isFreePlan: boolean;
  /** True for ADMIN_EMAILS / designated unlimited accounts. */
  isAdmin: boolean;
  /** On-screen + download brand watermark for free non-admin users only. */
  applyBrandWatermark: boolean;
  isAuthenticated: boolean;
  authUser: AuthUserProfile | null;
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
  /** Apply authoritative balance from API (generate / download / me). */
  applyServerCredits: (balance: number) => void;
  topUpCredits: (amount?: number) => void;
  purchaseCreditPack: (packId: (typeof CREDIT_PACKS)[number]["id"]) => Promise<void>;
  grantFreeCredits: () => void;
  refreshAccount: () => Promise<void>;
  signOutUser: () => Promise<void>;
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
    mode?: "retouch" | "regenerate",
    opts?: { skipCredit?: boolean }
  ) => RetouchAttemptResult;
  dailyRetouchCount: number;
};

const CreditsContext = createContext<CreditsContextValue | null>(null);

function clearBrowserAuthResidue() {
  if (typeof window === "undefined") return;

  // Clears local UI caches only. Cloud-backed face profiles, general photos,
  // and finished works live on R2/server manifests and reload after the next sign-in.
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }

  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }

  try {
    for (const raw of document.cookie.split(";")) {
      const name = raw.split("=")[0]?.trim();
      if (!name) continue;
      document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
    }
  } catch {
    /* ignore */
  }
}

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
  const [authUser, setAuthUser] = useState<AuthUserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
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
  const unlimitedCredits = hasUnlimitedCredits(authUser?.email);
  const creditsLabel = unlimitedCredits ? "∞" : String(credits);
  const applyBrandWatermark = shouldApplyBrandWatermark(
    planId,
    authUser?.email,
    isAdmin
  );

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

  // Surface OAuth failures from /auth/callback → /generate?authError=… (any path works)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      const authError = url.searchParams.get("authError");
      if (!authError) return;
      stashAuthErrorForModal(authError);
      setShowAuthModal(true);
      url.searchParams.delete("authError");
      const clean = `${url.pathname}${url.searchParams.toString() ? `?${url.searchParams}` : ""}${url.hash}`;
      window.history.replaceState({}, "", clean);
    } catch {
      /* ignore */
    }
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
      const res = await fetch("/api/account/me", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("account unavailable");
      const data = (await res.json()) as {
        authenticated?: boolean;
        pendingTermsConsent?: boolean;
        providers?: SocialProviderId[];
        user?: {
          id?: string;
          email?: string | null;
          name?: string | null;
          image?: string | null;
          credits: number;
          maxCredits: number;
          planId: PlanId;
          billingInterval?: BillingInterval | null;
          isAdmin?: boolean;
        } | null;
      };
      if (Array.isArray(data.providers)) {
        setSocialProviders(data.providers);
        setSocialProvidersLoaded(true);
      }
      if (data.authenticated && data.user) {
        setIsAuthenticated(true);
        setAuthUser({
          id: data.user.id ?? null,
          email: data.user.email ?? null,
          name: data.user.name ?? null,
          image: data.user.image ?? null,
        });
        setIsAdmin(Boolean(data.user.isAdmin));
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

      if (data.pendingTermsConsent) {
        // Keep Supabase-driven UI auth; app member not finalized yet.
        setSocialProvidersLoaded(true);
        return;
      }

      // No NextAuth member session — leave Supabase listener as source of truth
      // unless it already cleared auth.
      setSocialProvidersLoaded(true);
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

  const signOutUser = useCallback(async () => {
    try {
      const { isSupabaseConfigured } = await import("@/lib/supabase/config");
      if (isSupabaseConfigured()) {
        const { createSupabaseBrowserClient } = await import(
          "@/lib/supabase/client"
        );
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut();
      }
    } catch {
      /* still clear app session */
    }

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {
      /* ignore */
    }

    try {
      const { signOut } = await import("next-auth/react");
      await signOut({ redirect: false });
    } catch {
      /* ignore */
    }

    clearBrowserAuthResidue();
    setIsAuthenticated(false);
    setAuthUser(null);
    setIsAdmin(false);
    setCredits(FREE_CREDITS);
    setMaxCredits(FREE_CREDITS);
    setPlanId("free");
    setBillingInterval("monthly");
    setPromoWallet(null);
    setPendingPlanId(null);
    setPendingBillingInterval("annual");
    setSocialProviders([]);
    setSocialProvidersLoaded(false);
    setShowPaymentModal(false);
    setShowCreditModal(false);
    setShowTopUpModal(false);
    setShowReturnModal(false);
    setShowPromoModal(false);
    setShowAuthModal(false);
    setPortraits({});
    setDailyRetouchCount(0);
    recentRetouchTs.current = [];
    pendingResumeDone.current = false;
    patchAccountMeta({ planId: "free", lastLoginAt: 0 });
  }, []);

  // Supabase session → header auth UI (survives cold local DB / post-consent reload).
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      try {
        const { isSupabaseConfigured } = await import("@/lib/supabase/config");
        if (!isSupabaseConfigured()) {
          void refreshServerState();
          return;
        }
        const { createSupabaseBrowserClient } = await import(
          "@/lib/supabase/client"
        );
        const supabase = createSupabaseBrowserClient();

        const applySupabaseUser = (
          sbUser: {
            id: string;
            email?: string | null;
            user_metadata?: Record<string, unknown> | null;
          } | null
        ) => {
          if (cancelled) return;
          if (!sbUser) return;
          const meta = sbUser.user_metadata ?? {};
          const image =
            (typeof meta.avatar_url === "string" && meta.avatar_url) ||
            (typeof meta.picture === "string" && meta.picture) ||
            null;
          const name =
            (typeof meta.full_name === "string" && meta.full_name) ||
            (typeof meta.name === "string" && meta.name) ||
            null;
          setIsAuthenticated(true);
          setAuthUser((prev) => ({
            id: sbUser.id,
            email: sbUser.email ?? prev?.email ?? null,
            name: name ?? prev?.name ?? null,
            image: image ?? prev?.image ?? null,
          }));
          setShowAuthModal(false);
        };

        const { data: initial } = await supabase.auth.getSession();
        if (cancelled) return;
        if (initial.session?.user) {
          applySupabaseUser(initial.session.user);
        }
        await refreshServerState();

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
          if (cancelled) return;
          if (event === "SIGNED_OUT") {
            setIsAuthenticated(false);
            setAuthUser(null);
            setIsAdmin(false);
            return;
          }
          if (session?.user) {
            applySupabaseUser(session.user);
            void refreshServerState();
          }
        });
        unsubscribe = () => subscription.unsubscribe();
      } catch {
        if (!cancelled) void refreshServerState();
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [refreshServerState]);

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
        if (isPrivilegedAdminEmail(authUser?.email)) {
          // Mirror server auto-refill so QA can keep spending after 0.
          setCredits(Math.max(0, ADMIN_TEST_CREDITS - amount));
          setMaxCredits((m) => Math.max(m, ADMIN_TEST_CREDITS));
          return true;
        }
        setShowCreditModal(true);
        return false;
      }
      setCredits((c) => {
        const next = Math.max(0, Math.round((c - amount) * 10) / 10);
        if (next <= 0 && isPrivilegedAdminEmail(authUser?.email)) {
          setMaxCredits((m) => Math.max(m, ADMIN_TEST_CREDITS));
          return ADMIN_TEST_CREDITS;
        }
        return next;
      });
      return true;
    },
    [authUser?.email, credits]
  );

  const applyServerCredits = useCallback(
    (balance: number) => {
      if (!Number.isFinite(balance)) return;
      let next = Math.round(Math.max(0, balance) * 10) / 10;
      if (next <= 0 && isPrivilegedAdminEmail(authUser?.email)) {
        next = ADMIN_TEST_CREDITS;
        setMaxCredits((m) => Math.max(m, ADMIN_TEST_CREDITS));
      } else if (isPrivilegedAdminEmail(authUser?.email)) {
        setMaxCredits((m) => Math.max(m, ADMIN_TEST_CREDITS, next));
      } else {
        setMaxCredits((m) => Math.max(m, next));
      }
      setCredits(next);
    },
    [authUser?.email]
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
      // TEMP KCP review: guest checkout via isGuestCheckoutAllowedClient().
      // Restore member-only: set ALLOW_GUEST_CHECKOUT=false (see lib/checkoutPolicy.ts).
      if (!isAuthenticated && !isGuestCheckoutAllowedClient()) {
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
      mode: "retouch" | "regenerate" = "retouch",
      opts?: { skipCredit?: boolean }
    ): RetouchAttemptResult => {
      const currentDaily = ensureDailyCounter();
      const existing = portraits[portraitId];
      const createdAt = existing?.createdAt ?? Date.now();
      const spendCredits = hasUnlimitedCredits(authUser?.email)
        ? Number.POSITIVE_INFINITY
        : credits;

      const result = evaluateRetouchRequest({
        state: existing ?? null,
        portraitId,
        createdAt,
        // When billing already happened (generate API / spend API), only update
        // retouch bookkeeping — do not re-check or re-deduct wallet balance.
        credits: opts?.skipCredit ? Number.POSITIVE_INFINITY : spendCredits,
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

      if (
        result.cost > 0 &&
        !opts?.skipCredit &&
        !hasUnlimitedCredits(authUser?.email)
      ) {
        setCredits((c) => {
          const next = Math.max(0, Math.round((c - result.cost) * 10) / 10);
          if (next <= 0 && isPrivilegedAdminEmail(authUser?.email)) {
            setMaxCredits((m) => Math.max(m, ADMIN_TEST_CREDITS));
            return ADMIN_TEST_CREDITS;
          }
          return next;
        });
      }
      setPortraits((prev) => ({ ...prev, [portraitId]: result.state }));
      setDailyRetouchCount((n) => n + 1);
      return result;
    },
    [authUser?.email, credits, ensureDailyCounter, portraits]
  );

  const value = useMemo(
    () => ({
      credits,
      maxCredits,
      unlimitedCredits,
      creditsLabel,
      isFreePlan,
      isAdmin,
      applyBrandWatermark,
      isAuthenticated,
      authUser,
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
      applyServerCredits,
      topUpCredits,
      purchaseCreditPack,
      grantFreeCredits,
      refreshAccount,
      signOutUser,
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
      unlimitedCredits,
      creditsLabel,
      isFreePlan,
      isAdmin,
      applyBrandWatermark,
      isAuthenticated,
      authUser,
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
      applyServerCredits,
      topUpCredits,
      purchaseCreditPack,
      grantFreeCredits,
      refreshAccount,
      signOutUser,
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
