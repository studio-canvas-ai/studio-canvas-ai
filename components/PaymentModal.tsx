"use client";

import { useEffect, useState } from "react";
import { CalendarClock, CreditCard, Sparkles, X } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";
import { getPlanOffer, isPrepaidPass } from "@/lib/data";
import { formatKrw, formatUsd } from "@/lib/currency";
import { resolveCheckoutRegion } from "@/lib/paymentRouting";
import {
  isGuestCheckoutAllowedClient,
  KCP_RECURRING_ENABLED,
} from "@/lib/checkoutPolicy";

export default function PaymentModal() {
  const { t, locale } = useI18n();
  const {
    showPaymentModal,
    setShowPaymentModal,
    pendingPlanId,
    pendingBillingInterval,
    refreshAccount,
    isAuthenticated,
    authUser,
    openAuthModal,
  } = useCredits();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [recurringConsentAgreed, setRecurringConsentAgreed] = useState(false);
  const [useBcCardMonthlyOneTime, setUseBcCardMonthlyOneTime] = useState(false);
  const [accountReady, setAccountReady] = useState(false);
  const [accountChecking, setAccountChecking] = useState(false);
  const guestCheckout = isGuestCheckoutAllowedClient();

  useEffect(() => {
    if (!showPaymentModal || !pendingPlanId) return;
    let cancelled = false;
    setAccountReady(guestCheckout);
    setAccountChecking(true);
    setError(null);
    setTermsAgreed(false);
    setRecurringConsentAgreed(false);
    setUseBcCardMonthlyOneTime(false);
    void (async () => {
      try {
        await refreshAccount();
      } finally {
        if (!cancelled) setAccountChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showPaymentModal, pendingPlanId, refreshAccount, guestCheckout]);

  useEffect(() => {
    if (!showPaymentModal || accountChecking) return;
    if (guestCheckout) {
      setAccountReady(true);
      setError((prev) => (prev === t.payment.signInRequired ? null : prev));
      return;
    }
    const ready = Boolean(isAuthenticated && authUser?.id);
    setAccountReady(ready);
    if (!ready) {
      setError(t.payment.signInRequired);
    } else {
      setError((prev) => (prev === t.payment.signInRequired ? null : prev));
    }
  }, [
    showPaymentModal,
    accountChecking,
    isAuthenticated,
    authUser?.id,
    t.payment.signInRequired,
    guestCheckout,
  ]);

  if (!showPaymentModal || !pendingPlanId) return null;

  const region = resolveCheckoutRegion(locale);
  let billingInterval =
    region === "global" && pendingBillingInterval === "quarterly"
      ? ("annual" as const)
      : region === "domestic" && pendingBillingInterval === "annual"
        ? ("quarterly" as const)
        : pendingBillingInterval;

  let checkoutPlanId = pendingPlanId;
  if (checkoutPlanId === "enterprise" && billingInterval !== "annual") {
    checkoutPlanId = "pro";
  }

  const offer = getPlanOffer(checkoutPlanId, billingInterval);
  const planName =
    checkoutPlanId === "enterprise"
      ? "Pro"
      : checkoutPlanId === "standard"
        ? "Standard"
        : checkoutPlanId === "pro"
          ? "Pro"
          : "Starter";

  const showDomesticKrw =
    region === "domestic" &&
    (billingInterval === "monthly" || billingInterval === "quarterly");
  const priceLabel = showDomesticKrw
    ? formatKrw(offer.totalKrw)
    : formatUsd(offer.totalUsd);
  const isPrepaid = isPrepaidPass(billingInterval);
  const isRecurringMonthly = region === "domestic" && !isPrepaid;
  const bcMonthlyOneTime = isRecurringMonthly && useBcCardMonthlyOneTime;
  const showKcpRecurringUi =
    KCP_RECURRING_ENABLED && isRecurringMonthly && !bcMonthlyOneTime;
  const bcCardMonthlyOptionLabel = "BC카드로 월 결제를 진행합니다";
  const bcCardMonthlyNotice =
    "BC카드의 카드사 정책상 자동 정기과금이 제한되어, 당월 이용금액 단건결제(1회성 결제)로 안전하게 진행됩니다.";
  const bcCardOneTimeButtonLabel = "BC카드 월 이용금액 단건결제";
  const payDisabled =
    paying ||
    !termsAgreed ||
    (showKcpRecurringUi && !recurringConsentAgreed) ||
    accountChecking ||
    !accountReady;

  const startCheckout = async (mode: "domestic" | "stripe" | "demo") => {
    if (!termsAgreed) {
      setError(t.payment.termsRequired);
      return;
    }
    if (showKcpRecurringUi && !recurringConsentAgreed) {
      setError(t.payment.recurringConsentRequired);
      return;
    }
    if (!guestCheckout && !(isAuthenticated && authUser?.id)) {
      setShowPaymentModal(false);
      openAuthModal();
      return;
    }
    setPaying(true);
    setError(null);
    try {
      try {
        await refreshAccount();
      } catch {
        /* guest checkout continues without a session */
      }

      const checkoutLocale =
        mode === "domestic" ? "kr" : mode === "stripe" ? "en" : locale;
      let checkoutInterval =
        mode === "stripe" && billingInterval === "quarterly"
          ? ("annual" as const)
          : mode === "domestic" && billingInterval === "annual"
            ? ("quarterly" as const)
            : billingInterval;
      let planIdForOrder = checkoutPlanId;
      if (planIdForOrder === "enterprise" && checkoutInterval !== "annual") {
        planIdForOrder = "pro";
      }

      const createRes = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "subscription",
          planId: planIdForOrder,
          billingInterval: checkoutInterval,
          locale: checkoutLocale,
          domesticCardBrand:
            mode === "domestic" && bcMonthlyOneTime ? "bc" : undefined,
        }),
        credentials: "same-origin",
      });

      if (createRes.status === 401) {
        setShowPaymentModal(false);
        openAuthModal();
        return;
      }

      const created = (await createRes.json()) as {
        order?: {
          id: string;
          amountKrw: number;
          provider?: string;
        };
        provider?: string;
        checkoutUrl?: string | null;
        portoneStoreId?: string | null;
        portoneChannelKey?: string | null;
        portoneBillingChannelKey?: string | null;
        checkoutMode?: "recurring_billing_key" | "one_time";
        customer?: {
          id?: string | null;
          email?: string | null;
          name?: string | null;
        };
        demoAllowed?: boolean;
        successUrl?: string;
        failUrl?: string;
        error?: string;
      };

      if (!createRes.ok || !created.order) {
        if (
          created.error === "user not found" ||
          created.error === "terms_required" ||
          created.error === "authentication required"
        ) {
          await refreshAccount();
          setError(t.payment.signInRequired);
          return;
        }
        throw new Error(created.error || "order failed");
      }

      if (created.checkoutUrl) {
        window.location.href = created.checkoutUrl;
        return;
      }

      if (mode === "domestic") {
        const {
          requestPortOnePayment,
          requestPortOneBillingKey,
          getPortoneStoreId,
          getPortoneChannelKey,
          resolvePortoneBillingChannelKey,
          PORTONE_DEFAULT_STORE_ID,
          PORTONE_DEFAULT_CHANNEL_KEY,
        } = await import("@/lib/payments/portone");

        const storeId =
          created.portoneStoreId?.trim() ||
          getPortoneStoreId() ||
          PORTONE_DEFAULT_STORE_ID;
        const channelKey =
          created.portoneChannelKey?.trim() ||
          getPortoneChannelKey() ||
          PORTONE_DEFAULT_CHANNEL_KEY;

        const orderToken = created.order.id.replace(/[^a-zA-Z0-9]/g, "");
        const redirectUrl =
          created.successUrl ||
          `${window.location.origin}/pricing?payment=success&orderId=${encodeURIComponent(created.order.id)}`;

        const customerPayload = {
          customerId: created.customer?.id || authUser?.id,
          customerEmail:
            created.customer?.email ||
            authUser?.email ||
            "guest@checkout.studio-canvas-ai.local",
          customerName:
            created.customer?.name || authUser?.name || "Guest Checkout",
          customerPhone: "010-0000-1234",
        };

        const useRecurringBilling =
          KCP_RECURRING_ENABLED &&
          created.checkoutMode === "recurring_billing_key";

        if (useRecurringBilling) {
          const billingChannelKey = resolvePortoneBillingChannelKey(
            created.portoneBillingChannelKey
          );
          const issueId = `issue${orderToken}`.slice(0, 40);
          const issueName = `Studio Canvas AI ${planName} 월간 정기결제`;

          const issueRes = await requestPortOneBillingKey({
            storeId,
            channelKey: billingChannelKey,
            issueId,
            issueName,
            redirectUrl,
            ...customerPayload,
          });

          if (issueRes?.code != null) {
            throw new Error(
              issueRes.pgMessage ||
                issueRes.message ||
                String(issueRes.code)
            );
          }

          const billingKey = issueRes?.billingKey?.trim();
          if (!billingKey) {
            throw new Error(t.payment.recurringBillingKeyMissing);
          }

          const confirmRes = await fetch("/api/payments/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: created.order.id,
              billingKey,
              issueId,
            }),
            credentials: "same-origin",
          });

          if (!confirmRes.ok) {
            const confirmJson = (await confirmRes.json().catch(() => ({}))) as {
              error?: string;
            };
            if (confirmJson.error === "portone_secret_missing") {
              window.location.href = `${redirectUrl}&billingKeyIssued=1`;
              return;
            }
            if (confirmJson.error?.startsWith("portone_not_paid")) {
              window.location.href = `${redirectUrl}&billingKeyIssued=1`;
              return;
            }
            throw new Error(confirmJson.error || "recurring confirm failed");
          }

          await refreshAccount();
          setShowPaymentModal(false);
          return;
        }

        const paymentId = `payment${orderToken}`;

        const portoneRes = await requestPortOnePayment({
          storeId,
          channelKey,
          paymentId,
          orderName: `Studio Canvas AI ${planName}`,
          totalAmount: created.order.amountKrw,
          redirectUrl,
          ...customerPayload,
        });

        if (portoneRes?.code != null) {
          throw new Error(
            portoneRes.pgMessage ||
              portoneRes.message ||
              String(portoneRes.code)
          );
        }

        const confirmPaymentId = portoneRes?.paymentId || paymentId;
        const confirmRes = await fetch("/api/payments/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: created.order.id,
            paymentId: confirmPaymentId,
          }),
          credentials: "same-origin",
        });
        if (!confirmRes.ok) {
          const confirmJson = (await confirmRes.json().catch(() => ({}))) as {
            error?: string;
          };
          if (confirmJson.error === "portone_secret_missing") {
            window.location.href = `${redirectUrl}&paymentId=${encodeURIComponent(confirmPaymentId)}`;
            return;
          }
          if (confirmJson.error?.startsWith("portone_not_paid")) {
            window.location.href = `${redirectUrl}&paymentId=${encodeURIComponent(confirmPaymentId)}`;
            return;
          }
          throw new Error(confirmJson.error || "portone confirm failed");
        }
        await refreshAccount();
        setShowPaymentModal(false);
        return;
      }

      if (created.demoAllowed && mode !== "stripe") {
        const confirmRes = await fetch("/api/payments/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: created.order.id, demo: true }),
          credentials: "same-origin",
        });
        if (!confirmRes.ok) throw new Error("demo confirm failed");
        await refreshAccount();
        setShowPaymentModal(false);
        return;
      }

      throw new Error(
        mode === "stripe"
          ? "Stripe checkout is not configured"
          : "결제 수단을 열 수 없습니다. 잠시 후 다시 시도해 주세요."
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "payment failed";
      setError(
        message === "user not found" || message === "authentication required"
          ? t.payment.signInRequired
          : message === "portone_billing_channel_missing"
            ? locale === "kr"
              ? "정기결제 채널이 설정되지 않았습니다. NEXT_PUBLIC_PORTONE_BILLING_CHANNEL_KEY를 확인해 주세요."
              : "Recurring billing channel is not configured. Set NEXT_PUBLIC_PORTONE_BILLING_CHANNEL_KEY."
            : message
      );
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
        aria-label="Close"
        onClick={() => setShowPaymentModal(false)}
      />
      <div
        className="relative z-10 max-h-[min(92vh,880px)] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/12 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.65)] sm:max-w-2xl sm:p-10 lg:p-12"
        style={{
          background:
            "linear-gradient(165deg, #1a2235 0%, #121829 48%, #0f1420 100%)",
        }}
      >
        <button
          type="button"
          onClick={() => setShowPaymentModal(false)}
          className="absolute top-5 right-5 rounded-lg p-2 text-gray-300 hover:bg-white/10 hover:text-white sm:top-6 sm:right-6"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-7 flex items-center gap-4 pr-10 sm:mb-8">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-glow-purple to-glow-emerald">
            <CreditCard className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
              {showKcpRecurringUi ? t.payment.recurringTitle : t.payment.title}
            </h2>
            <p className="mt-1 text-sm font-medium leading-relaxed text-gray-200">
              {showKcpRecurringUi
                ? t.payment.recurringSubtitle
                : t.payment.subtitle}
            </p>
          </div>
        </div>

        <div className="mb-7 rounded-2xl border border-white/12 bg-white/[0.06] p-5 sm:mb-8 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 shrink-0 text-glow-purple" />
                <span className="text-base font-semibold text-white">{planName}</span>
              </div>
              <p className="mt-2 text-sm font-medium leading-relaxed text-gray-200">
                {(isPrepaid
                  ? t.payment.creditsIncludedAnnual
                  : t.payment.creditsIncluded
                ).replace("{count}", String(offer.credits))}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold tracking-tight text-white">
                {priceLabel}
              </div>
              <div className="mt-1 text-sm font-medium text-gray-200">
                {t.payment.vatIncluded}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {isPrepaid ? (
            <div className="rounded-2xl border border-amber-300/35 bg-amber-400/[0.1] p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <CalendarClock
                  className="mt-0.5 h-5 w-5 shrink-0 text-amber-200"
                  aria-hidden
                />
                <div className="space-y-2.5">
                  <p className="text-sm font-semibold leading-relaxed text-amber-50">
                    {billingInterval === "quarterly"
                      ? t.payment.quarterlyOneTimeNotice
                      : t.payment.annualOneTimeNotice}
                  </p>
                  <p className="text-sm font-medium leading-relaxed text-gray-200">
                    {billingInterval === "quarterly"
                      ? t.payment.quarterlyExpiryNotice
                      : t.payment.annualExpiryNotice}
                  </p>
                </div>
              </div>
            </div>
          ) : showKcpRecurringUi ? (
            <div className="space-y-3 rounded-2xl border border-violet-300/40 bg-violet-500/[0.12] p-4 sm:p-5">
              <p className="text-sm font-bold leading-relaxed text-violet-50">
                {t.payment.recurringBannerTitle}
              </p>
              <p className="text-sm font-medium leading-relaxed text-gray-100">
                {t.payment.autoRenewNotice}
              </p>
              <p className="text-sm font-medium leading-relaxed text-gray-200">
                {t.payment.recurringStepsNotice}
              </p>
            </div>
          ) : bcMonthlyOneTime ? (
            <div className="space-y-3 rounded-2xl border border-emerald-300/40 bg-emerald-500/[0.12] p-4 sm:p-5">
              <p className="text-sm font-bold leading-relaxed text-emerald-50">
                {bcCardMonthlyNotice}
              </p>
            </div>
          ) : null}
          <p className="text-sm font-medium leading-relaxed text-gray-200">
            {t.payment.refundNotice}
          </p>
          {isRecurringMonthly ? (
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-sky-300/30 bg-sky-500/[0.08] p-4 sm:p-5">
              <input
                type="checkbox"
                checked={useBcCardMonthlyOneTime}
                onChange={(e) => {
                  setUseBcCardMonthlyOneTime(e.target.checked);
                  if (e.target.checked) {
                    setRecurringConsentAgreed(false);
                  }
                }}
                className="mt-1 h-4 w-4 shrink-0 accent-sky-500"
                disabled={accountChecking}
              />
              <span className="text-sm font-medium leading-relaxed text-sky-50">
                {bcCardMonthlyOptionLabel}
              </span>
            </label>
          ) : null}
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/12 bg-white/[0.05] p-4 sm:p-5">
            <input
              type="checkbox"
              checked={termsAgreed}
              onChange={(e) => setTermsAgreed(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-violet-500"
              disabled={accountChecking}
            />
            <span className="text-sm font-medium leading-relaxed text-gray-100">
              {t.payment.termsLabel}
            </span>
          </label>
          {showKcpRecurringUi ? (
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-pink-400/50 bg-pink-500/[0.12] p-4 sm:p-5 shadow-[0_0_0_1px_rgba(244,114,182,0.25)]">
              <input
                type="checkbox"
                checked={recurringConsentAgreed}
                onChange={(e) => setRecurringConsentAgreed(e.target.checked)}
                className="mt-1 h-5 w-5 shrink-0 accent-pink-500"
                disabled={accountChecking}
              />
              <span className="text-sm font-bold leading-relaxed text-pink-50">
                {t.payment.recurringConsentLabel}
              </span>
            </label>
          ) : null}
          <p className="text-sm font-medium leading-relaxed text-gray-200">
            {bcMonthlyOneTime
              ? t.payment.secureCheckout
              : showKcpRecurringUi
              ? t.payment.recurringSecureCheckout
              : t.payment.secureCheckout}
          </p>
          {accountChecking && (
            <p className="text-sm font-medium leading-relaxed text-gray-200">
              {t.payment.accountPreparing}
            </p>
          )}
          {error && (
            <p className="text-sm font-semibold leading-relaxed text-amber-200">
              {error}
            </p>
          )}

          {!accountChecking && !accountReady ? (
            <button
              type="button"
              onClick={() => {
                setShowPaymentModal(false);
                openAuthModal();
              }}
              className="btn-primary w-full py-3.5 text-base"
            >
              {t.auth.login}
            </button>
          ) : region === "domestic" ? (
            <button
              type="button"
              disabled={payDisabled}
              onClick={() => void startCheckout("domestic")}
              className="btn-primary w-full py-3.5 text-base disabled:opacity-50"
            >
              {paying
                ? t.payment.processing
                : accountChecking
                  ? t.payment.accountPreparing
                  : bcMonthlyOneTime
                    ? bcCardOneTimeButtonLabel
                  : showKcpRecurringUi
                    ? t.payment.payWithKcpRecurring
                    : t.payment.payWithToss}
            </button>
          ) : (
            <button
              type="button"
              disabled={payDisabled}
              onClick={() => void startCheckout("stripe")}
              className="btn-primary w-full py-3.5 text-base disabled:opacity-50"
            >
              {paying
                ? t.payment.redirecting
                : accountChecking
                  ? t.payment.accountPreparing
                  : t.payment.payWithStripe}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
