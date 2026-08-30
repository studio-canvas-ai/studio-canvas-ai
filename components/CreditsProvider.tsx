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
} from "@/lib/unlimitedAccount";
import { shouldApplyBrandWatermark } from "@/lib/watermarkPolicy";
import { stashAuthErrorForModal } from "@/lib/supabase/oauthErrors";
import { clearAuthStorageOnly } from "@/lib/auth/clearAuthStorage";
import { SESSION_LOCK_STORAGE_KEY } from "@/lib/auth/sessionLockShared";
import type { PlanUsageSnapshot } from "@/lib/planQuotas";

const PLAN_USAGE_CACHE_KEY = "sca_plan_usage_v1";

type CachedPlanUsagePayload = PlanUsageSnapshot & {
  quotaPeriodStart?: number;
};

function readCachedPlanUsage(): PlanUsageSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PLAN_USAGE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPlanUsagePayload;
    if (
      typeof parsed?.fhdRemaining !== "number" ||
      typeof parsed?.uhd4kRemaining !== "number"
    ) {
      return null;
    }
    return {
      fhdRemaining: parsed.fhdRemaining,
      fhdLimit: parsed.fhdLimit ?? 0,
      uhd4kRemaining: parsed.uhd4kRemaining,
      uhd4kLimit: parsed.uhd4kLimit ?? 0,
      galleryLimit: parsed.galleryLimit ?? 0,
    };
  } catch {
    return null;
  }
}

function writeCachedPlanUsage(
  usage: PlanUsageSnapshot | null,
  quotaPeriodStart?: number
) {
  if (typeof window === "undefined") return;
  try {
    if (!usage) {
      localStorage.removeItem(PLAN_USAGE_CACHE_KEY);
      return;
    }
    const payload: CachedPlanUsagePayload = {
      ...usage,
      ...(typeof quotaPeriodStart === "number" ? { quotaPeriodStart } : {}),
    };
    localStorage.setItem(PLAN_USAGE_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota */
  }
}

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
  planUsage: PlanUsageSnapshot | null;
  consumeDownloadQuota: (
    kind: "fhd" | "uhd4k",
    opts?: { amount?: number; action?: string }
  ) => Promise<{ ok: boolean; remaining: number; usage: PlanUsageSnapshot | null }>;
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
  // Auth/session keys only. Never Storage.clear() — studio vaults and recent
  // files must survive logout in the same browser.
  clearAuthStorageOnly();
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
  const [planUsage, setPlanUsageState] = useState<PlanUsageSnapshot | null>(null);
  const quotaPeriodStartRef = useRef<number | null>(null);
  const setPlanUsage = useCallback((usage: PlanUsageSnapshot | null) => {
    setPlanUsageState(usage);
    writeCachedPlanUsage(usage, quotaPeriodStartRef.current ?? undefined);
  }, []);
  const [portraits, setPortraits] = useState<Record<string, PortraitRetouchState>>({});
  const [dailyRetouchCount, setDailyRetouchCount] = useState(0);
  const [dailyKey, setDailyKey] = useState(todayKey);
  const recentRetouchTs = useRef<number[]>([]);
  const pendingResumeDone = useRef(false);

  const isFreePlan = planId === "free";
  const unlimitedCredits = hasUnlimitedCredits(authUser?.email);
  // Navbar badge: durable credit pool (fhdRemaining), not legacy wallet (always 0).
  const poolRemaining =
    typeof planUsage?.fhdRemaining === "number" ? planUsage.fhdRemaining : null;
  const creditsLabel = unlimitedCredits
    ? "∞"
    : poolRemaining != null
      ? poolRemaining.toLocaleString("ko-KR")
      : "—";
  const applyBrandWatermark = shouldApplyBrandWatermark(
    planId,
    authUser?.email,
    isAdmin
  );

  useEffect(() => {
    const cached = readCachedPlanUsage();
    if (cached) setPlanUsageState(cached);
    const meta = getAccountMeta();
    if (meta.hadPaidPlan || meta.lastLoginAt) setIsAuthenticated(true);
    if (meta.planId && meta.planId !== "free") {
      setPlanId(meta.planId);
      if (meta.planId === "enterprise") setBillingInterval("annual");
      setCredits(0);
      setMaxCredits(0);
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
          currentPeriodStart?: number | null;
          isAdmin?: boolean;
          usage?: PlanUsageSnapshot | null;
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
        setCredits(0);
        setMaxCredits(0);
        setPlanId(data.user.planId);
        setBillingInterval(data.user.billingInterval ?? "monthly");
        quotaPeriodStartRef.current =
          typeof data.user.currentPeriodStart === "number"
            ? data.user.currentPeriodStart
            : null;
        if (data.user.usage) setPlanUsage(data.user.usage);
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
    try {
      localStorage.removeItem(SESSION_LOCK_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setIsAuthenticated(false);
    setAuthUser(null);
    setIsAdmin(false);
    setCredits(FREE_CREDITS);
    setMaxCredits(FREE_CREDITS);
    setPlanUsage(null);
    quotaPeriodStartRef.current = null;
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
        setShowCreditModal(true);
        return false;
      }
      setCredits((c) => Math.max(0, Math.round((c - amount) * 10) / 10));
      return true;
    },
    [credits]
  );

  const applyServerCredits = useCallback((balance: number) => {
    if (!Number.isFinite(balance)) return;
    const next = Math.round(Math.max(0, balance) * 10) / 10;
    setCredits(next);
    setMaxCredits((m) => Math.max(m, next));
  }, []);

  const consumeDownloadQuota = useCallback(
    async (
      kind: "fhd" | "uhd4k",
      opts?: { amount?: number; action?: string }
    ) => {
      try {
        const res = await fetch("/api/quota/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            kind,
            ...(typeof opts?.amount === "number" ? { amount: opts.amount } : {}),
            ...(opts?.action ? { action: opts.action } : {}),
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          remaining?: number;
          usage?: PlanUsageSnapshot | null;
        };
        if (data.usage) setPlanUsage(data.usage);
        if (!res.ok || !data.ok) {
          return {
            ok: false,
            remaining: data.remaining ?? 0,
            usage: data.usage ?? planUsage,
          };
        }
        return {
          ok: true,
          remaining: data.remaining ?? 0,
          usage: data.usage ?? planUsage,
        };
      } catch {
        return { ok: false, remaining: 0, usage: planUsage };
      }
    },
    [planUsage]
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
        setCredits((c) => Math.max(0, Math.round((c - result.cost) * 10) / 10));
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
      planUsage,
      consumeDownloadQuota,
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
      planUsage,
      consumeDownloadQuota,
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
