"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useCredits } from "@/components/CreditsProvider";
import { useI18n } from "@/components/I18nProvider";
import { clearPendingCheckout } from "@/lib/pendingCheckout";

/** Poll account after PG return until webhook/confirm updates credits. */
export default function PaymentReturnBanner() {
  const searchParams = useSearchParams();
  const status = searchParams.get("payment");
  const billingKeyIssued = searchParams.get("billingKeyIssued") === "1";
  const { refreshAccount, planId } = useCredits();
  const { t } = useI18n();

  useEffect(() => {
    if (status !== "success" && status !== "fail") return;
    try {
      clearPendingCheckout();
    } catch {
      /* ignore */
    }
    void refreshAccount();
  }, [status, refreshAccount]);

  // Old buggy path redirected here without markOrderPaid — do not celebrate.
  if (status === "success" && billingKeyIssued && planId === "free") {
    return (
      <div className="mx-auto mb-4 max-w-3xl rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-center text-sm text-amber-100">
        카드 등록만 확인되었고 이용권/크레딧 반영은 완료되지 않았습니다. 요금제에서
        다시 결제를 완료해 주세요.
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="mx-auto mb-4 max-w-3xl rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-center text-sm text-emerald-100">
        {t.payment.returnSuccess}
      </div>
    );
  }

  if (status === "fail") {
    return (
      <div className="mx-auto mb-4 max-w-3xl rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-center text-sm text-red-100">
        {t.payment.returnFail}
      </div>
    );
  }

  return null;
}
