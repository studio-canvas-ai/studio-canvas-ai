"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCredits } from "@/components/CreditsProvider";
import { useI18n } from "@/components/I18nProvider";
import { clearPendingCheckout } from "@/lib/pendingCheckout";
import {
  clearPendingPaymentContext,
  readPendingPaymentContext,
} from "@/lib/pendingPaymentContext";

/** After PG return: always try confirm, then refresh until credits appear. */
export default function PaymentReturnBanner() {
  const searchParams = useSearchParams();
  const status = searchParams.get("payment");
  const orderIdParam = searchParams.get("orderId");
  const paymentIdParam = searchParams.get("paymentId");
  const billingKeyParam = searchParams.get("billingKey");
  const { refreshAccount, planId, completePayment } = useCredits();
  const { t } = useI18n();
  const [phase, setPhase] = useState<"idle" | "working" | "ok" | "fail">(
    "idle"
  );
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "success" && status !== "fail") return;
    if (status === "fail") {
      setPhase("fail");
      clearPendingCheckout();
      clearPendingPaymentContext();
      return;
    }

    let cancelled = false;
    setPhase("working");

    void (async () => {
      try {
        clearPendingCheckout();
        const ctx = readPendingPaymentContext();
        const orderId = orderIdParam || ctx?.orderId || null;
        const billingKey = billingKeyParam || ctx?.billingKey || null;
        const paymentId = paymentIdParam || ctx?.paymentId || null;
        const issueId = ctx?.issueId || undefined;

        if (orderId && (billingKey || paymentId)) {
          const confirmRes = await fetch("/api/payments/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              orderId,
              ...(billingKey ? { billingKey, issueId } : {}),
              ...(paymentId ? { paymentId } : {}),
            }),
          });
          const json = (await confirmRes.json().catch(() => ({}))) as {
            error?: string;
            user?: {
              id?: string | null;
              planId?: string | null;
              billingInterval?: string | null;
              usage?: {
                fhdRemaining: number;
                fhdLimit: number;
                uhd4kRemaining: number;
                uhd4kLimit: number;
                galleryLimit: number;
              } | null;
            };
          };
          if (confirmRes.ok && json.user?.planId && json.user.planId !== "free") {
            await completePayment(json.user);
            clearPendingPaymentContext();
            if (!cancelled) setPhase("ok");
            return;
          }
          if (!confirmRes.ok && json.error && json.error !== "order not found") {
            if (!cancelled) setDetail(json.error);
          }
        }

        for (let i = 0; i < 5; i += 1) {
          await refreshAccount();
          await new Promise((r) => setTimeout(r, 400));
          if (cancelled) return;
        }
        clearPendingPaymentContext();
        if (!cancelled) setPhase("ok");
      } catch (err) {
        if (!cancelled) {
          setPhase("fail");
          setDetail(err instanceof Error ? err.message : "confirm failed");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    status,
    orderIdParam,
    paymentIdParam,
    billingKeyParam,
    refreshAccount,
    completePayment,
  ]);

  if (status === "fail" || phase === "fail") {
    return (
      <div className="mx-auto mb-4 max-w-3xl rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-center text-sm text-red-100">
        {detail || t.payment.returnFail}
      </div>
    );
  }

  if (status !== "success") return null;

  if (phase === "working") {
    return (
      <div className="mx-auto mb-4 max-w-3xl rounded-xl border border-sky-400/25 bg-sky-400/10 px-4 py-3 text-center text-sm text-sky-100">
        결제 확인 중… 이용권/크레딧을 반영하고 있습니다.
      </div>
    );
  }

  if (planId === "free") {
    return (
      <div className="mx-auto mb-4 max-w-3xl rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-center text-sm text-amber-100">
        결제는 접수됐지만 이용권이 아직 반영되지 않았습니다. 잠시 후 새로고침하거나
        고객센터로 문의해 주세요.
        {detail ? ` (${detail})` : null}
      </div>
    );
  }

  return (
    <div className="mx-auto mb-4 max-w-3xl rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-center text-sm text-emerald-100">
      {t.payment.returnSuccess}
    </div>
  );
}
