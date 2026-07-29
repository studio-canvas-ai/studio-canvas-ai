"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useCredits } from "@/components/CreditsProvider";
import { useI18n } from "@/components/I18nProvider";

/** Poll account after PG return until webhook/confirm updates credits. */
export default function PaymentReturnBanner() {
  const searchParams = useSearchParams();
  const status = searchParams.get("payment");
  const { refreshAccount } = useCredits();
  const { t } = useI18n();

  useEffect(() => {
    if (status !== "success" && status !== "fail") return;
    void refreshAccount();
  }, [status, refreshAccount]);

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
