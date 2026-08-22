"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CreditCard,
  ExternalLink,
  Loader2,
  LogOut,
  RefreshCw,
  User,
  XCircle,
} from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";
import Navbar from "@/components/Navbar";
import type { BillingInterval } from "@/lib/data";
import { isPrepaidPass } from "@/lib/data";
import { normalizeSubscriptionLifecycle } from "@/lib/subscriptionState";

type AccountSnapshot = {
  id: string;
  email: string | null;
  name: string | null;
  credits: number;
  planId: string;
  billingInterval: BillingInterval | null;
  currentPeriodEnd: number | null;
  subscriptionLifecycle?: string;
  cancelAtPeriodEnd?: boolean;
  defaultPaymentMethodLabel?: string | null;
  stripeCustomerId?: string | null;
};

type Receipt = {
  id: string;
  kind: string;
  amountUsd: number;
  amountKrw: number;
  currency: string;
  credits: number;
  paidAt: number;
  receiptUrl: string | null;
  provider: string;
  status?: string;
  refundEligible?: boolean;
};

function planLabel(planId: string) {
  if (planId === "enterprise") return "Enterprise";
  if (planId === "standard") return "Standard";
  if (planId === "pro") return "Pro";
  if (planId === "starter") return "Starter";
  return "Free";
}

function formatDate(ts: number | null | undefined, locale: string) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString(locale === "kr" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Softer slate surface for readable account cards (scoped to My Page). */
const pageShell =
  "relative min-h-screen text-slate-100";
const pageShellStyle = {
  backgroundImage:
    "radial-gradient(ellipse at top, rgba(148,163,184,0.14), transparent 55%), linear-gradient(180deg, #334155 0%, #1e293b 42%, #0f172a 100%)",
} as const;
const cardClass =
  "rounded-2xl border border-slate-500/35 bg-slate-700/55 p-6 shadow-[0_8px_32px_rgba(15,23,42,0.35)] backdrop-blur-md";
const insetClass =
  "rounded-xl border border-slate-500/30 bg-slate-800/50 p-4";
const labelClass = "text-xs uppercase tracking-wider text-slate-300";
const mutedClass = "text-sm text-slate-300";
const titleClass = "font-display text-3xl font-bold text-slate-50";

export default function ProfilePage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { isAuthenticated, openAuthModal, refreshAccount, signOutUser } =
    useCredits();
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [refundingId, setRefundingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, receiptsRes] = await Promise.all([
        fetch("/api/account/me"),
        fetch("/api/payments/receipts"),
      ]);
      const me = (await meRes.json()) as {
        authenticated?: boolean;
        user?: AccountSnapshot | null;
      };
      if (!me.authenticated || !me.user) {
        setAccount(null);
        return;
      }
      setAccount(me.user);
      if (receiptsRes.ok) {
        const data = (await receiptsRes.json()) as { receipts?: Receipt[] };
        setReceipts(data.receipts ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, isAuthenticated]);

  const backHomeLink = (
    <Link
      href="/"
      className="inline-flex items-center gap-2 rounded-lg px-1 py-1 text-sm font-medium text-slate-200 transition hover:bg-slate-600/40 hover:text-white"
    >
      <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
      {t.mypage.backToHome}
    </Link>
  );

  if (loading) {
    return (
      <main className={`${pageShell} flex items-center justify-center pt-16 md:pt-24`} style={pageShellStyle}>
        <Navbar />
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </main>
    );
  }

  if (!account) {
    return (
      <main className={`${pageShell} px-4 pt-16 pb-16 md:pt-28`} style={pageShellStyle}>
        <Navbar />
        <div className="mx-auto max-w-lg text-center">
          <div className="mb-6 flex justify-start">{backHomeLink}</div>
          <User className="mx-auto mb-4 h-10 w-10 text-slate-400" />
          <h1 className="text-xl font-semibold text-slate-50">{t.mypage.title}</h1>
          <p className={`mt-2 ${mutedClass}`}>{t.mypage.loginRequired}</p>
          <button
            type="button"
            onClick={() => openAuthModal({ clearPending: true })}
            className="btn-primary mt-6 px-6 py-2.5 text-sm"
          >
            {t.nav.login}
          </button>
        </div>
      </main>
    );
  }

  const lifecycle = normalizeSubscriptionLifecycle({
    subscriptionLifecycle: account.subscriptionLifecycle as
      | "ACTIVE"
      | "CANCELED_PENDING"
      | "EXPIRED"
      | undefined,
    subscriptionStatus: undefined,
    planId: account.planId as "free" | "starter" | "standard" | "pro" | "enterprise",
    currentPeriodEnd: account.currentPeriodEnd ?? undefined,
    cancelAtPeriodEnd: account.cancelAtPeriodEnd,
  });

  const lifecycleLabel =
    lifecycle === "CANCELED_PENDING"
      ? t.mypage.lifecycleCanceledPending
      : lifecycle === "ACTIVE"
        ? t.mypage.lifecycleActive
        : t.mypage.lifecycleExpired;

  const handlePortal = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/payments/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnUrl: `${window.location.origin}/profile` }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || "portal failed");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "failed");
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/payments/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "cancel failed");
      }
      setMessage(t.mypage.cancelSuccess);
      setShowCancel(false);
      await refreshAccount();
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "failed");
    } finally {
      setBusy(false);
    }
  };

  const handleResume = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/payments/subscription/resume", { method: "POST" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "resume failed");
      }
      setMessage(t.mypage.resumeSuccess);
      await refreshAccount();
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "failed");
    } finally {
      setBusy(false);
    }
  };

  const handleRefund = async (orderId: string) => {
    setRefundingId(orderId);
    setMessage(null);
    try {
      const res = await fetch("/api/payments/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        throw new Error(data.message || data.error || t.mypage.refundDenied);
      }
      setMessage(t.mypage.refundSuccess);
      await refreshAccount();
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t.mypage.refundDenied);
    } finally {
      setRefundingId(null);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setMessage(null);
    try {
      await signOutUser();
      router.replace("/");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "logout failed");
      setLoggingOut(false);
    }
  };

  return (
    <main className={`${pageShell} px-4 pt-16 pb-16 md:pt-28`} style={pageShellStyle}>
      <Navbar />
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">{backHomeLink}</div>

        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className={titleClass}>{t.mypage.title}</h1>
            <p className={`mt-2 ${mutedClass}`}>{t.mypage.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={loggingOut || busy}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-400/40 bg-slate-600/50 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-slate-300/50 hover:bg-slate-500/55 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loggingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            {loggingOut ? t.mypage.loggingOut : t.mypage.logout}
          </button>
        </div>

        {message && (
          <p className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-100">
            {message}
          </p>
        )}

        <section className={`${cardClass} mb-6`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className={labelClass}>{t.mypage.currentPlan}</p>
              <p className="mt-1 text-2xl font-semibold text-slate-50">
                {account.planId === "free" ? t.mypage.freePlan : planLabel(account.planId)}
              </p>
              <p className={`mt-1 ${mutedClass}`}>
                {t.mypage.creditsRemaining}: {account.credits}
              </p>
            </div>
            <span className="rounded-full border border-slate-400/40 bg-slate-600/60 px-3 py-1 text-xs text-slate-100">
              {lifecycleLabel}
            </span>
          </div>

          {account.planId !== "free" && (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className={insetClass}>
                <p className={labelClass}>{t.mypage.billingInterval}</p>
                <p className="mt-1 text-sm text-slate-50">
                  {account.billingInterval === "quarterly"
                    ? t.mypage.quarterly
                    : account.billingInterval === "annual"
                      ? t.mypage.annual
                      : t.mypage.monthly}
                </p>
              </div>
              <div className={insetClass}>
                <p className={labelClass}>
                  {account.billingInterval && isPrepaidPass(account.billingInterval)
                    ? t.mypage.expiryDate
                    : t.mypage.nextBilling}
                </p>
                <p className="mt-1 text-sm text-slate-50">
                  {formatDate(account.currentPeriodEnd, locale)}
                </p>
              </div>
              <div className={`${insetClass} sm:col-span-2`}>
                <p className={labelClass}>{t.mypage.paymentMethod}</p>
                <p className="mt-1 text-sm text-slate-50">
                  {account.defaultPaymentMethodLabel || account.stripeCustomerId
                    ? "Stripe"
                    : "—"}
                </p>
              </div>
            </div>
          )}

          {account.planId !== "free" &&
            account.billingInterval &&
            isPrepaidPass(account.billingInterval) && (
              <p className="mt-4 rounded-xl border border-amber-300/35 bg-amber-400/15 px-4 py-3 text-sm text-amber-50">
                {account.billingInterval === "quarterly"
                  ? t.mypage.quarterlyNoRenewNotice
                  : t.mypage.annualNoRenewNotice}
              </p>
            )}

          {lifecycle === "CANCELED_PENDING" && (
            <p className="mt-4 text-sm text-amber-100">{t.mypage.cancelPending}</p>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            {account.stripeCustomerId && account.billingInterval === "monthly" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handlePortal()}
                className="btn-secondary inline-flex items-center gap-2 px-4 py-2 text-sm"
              >
                <CreditCard className="h-4 w-4" />
                {t.mypage.changePayment}
              </button>
            )}
            {account.planId !== "free" &&
              account.billingInterval === "monthly" &&
              lifecycle === "ACTIVE" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setShowCancel(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-400/40 bg-red-500/20 px-4 py-2 text-sm text-red-50"
                >
                  <XCircle className="h-4 w-4" />
                  {t.mypage.cancelSubscription}
                </button>
              )}
            {account.billingInterval === "monthly" &&
              lifecycle === "CANCELED_PENDING" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleResume()}
                  className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
                >
                  <RefreshCw className="h-4 w-4" />
                  {t.mypage.resumeSubscription}
                </button>
              )}
            <Link href="/pricing" className="btn-secondary px-4 py-2 text-sm">
              {t.nav.pricing}
            </Link>
          </div>
        </section>

        {showCancel && (
          <section className={`${cardClass} mb-6`}>
            <h2 className="text-lg font-semibold text-slate-50">
              {t.mypage.cancelReasonTitle}
            </h2>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder={t.mypage.cancelReasonPlaceholder}
              className="mt-3 w-full rounded-xl border border-slate-500/40 bg-slate-800/70 px-4 py-3 text-sm text-slate-50 outline-none placeholder:text-slate-400 focus:border-slate-400/60"
              rows={3}
            />
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleCancel()}
                className="rounded-xl bg-red-500/90 px-4 py-2 text-sm text-white"
              >
                {t.mypage.confirmCancel}
              </button>
              <button
                type="button"
                onClick={() => setShowCancel(false)}
                className="btn-secondary px-4 py-2 text-sm"
              >
                {t.creator.deleteConfirmNo}
              </button>
            </div>
          </section>
        )}

        <section className={cardClass}>
          <h2 className="text-lg font-semibold text-slate-50">
            {t.mypage.paymentHistory}
          </h2>
          {receipts.length === 0 ? (
            <p className={`mt-4 ${mutedClass}`}>{t.mypage.noPayments}</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-500/30">
              {receipts.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="text-sm text-slate-50">
                      {r.kind === "subscription" ? "Subscription" : "Credit pack"} ·{" "}
                      {r.credits}C
                      {r.status === "refunded" ? (
                        <span className="ml-2 text-xs text-amber-200">
                          ({t.mypage.refunded})
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatDate(r.paidAt, locale)} · {r.provider}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium text-slate-50">
                      {r.currency === "USD"
                        ? `$${Number(r.amountUsd).toFixed(2)}`
                        : `₩${r.amountKrw.toLocaleString()}`}
                    </span>
                    {r.receiptUrl && (
                      <a
                        href={r.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-emerald-300 hover:underline"
                      >
                        {t.mypage.viewReceipt}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {r.status === "paid" && r.refundEligible && (
                      <button
                        type="button"
                        disabled={refundingId === r.id}
                        onClick={() => void handleRefund(r.id)}
                        className="rounded-lg border border-amber-300/40 bg-amber-400/15 px-2.5 py-1 text-xs font-medium text-amber-50 transition hover:bg-amber-400/25 disabled:opacity-50"
                      >
                        {refundingId === r.id ? "..." : t.mypage.requestRefund}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
