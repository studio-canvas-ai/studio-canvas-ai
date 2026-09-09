"use client";

import { useEffect, useState } from "react";
import {
  clearAuthConfirm,
  providerLabel,
  readAuthConfirm,
  type AuthConfirmPayload,
} from "@/lib/auth/confirmAccount";
import { buildTermsConsentUrl, safePostConsentPath } from "@/lib/termsConsent";
import { APP_HOME_PATH } from "@/lib/appRoutes";

export default function ConfirmAccountClient({
  nextPath,
}: {
  nextPath: string;
}) {
  const [payload, setPayload] = useState<AuthConfirmPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readAuthConfirm();
    if (!stored) {
      // Missing confirm payload — send provisional users to terms, else home.
      window.location.replace(safePostConsentPath(nextPath));
      return;
    }
    setPayload({
      ...stored,
      next: safePostConsentPath(stored.next || nextPath),
    });
    setReady(true);
  }, [nextPath]);

  const continueWithAccount = () => {
    if (!payload || busy) return;
    setBusy(true);
    const next = safePostConsentPath(payload.next);
    clearAuthConfirm();
    if (payload.needsTermsConsent) {
      window.location.replace(buildTermsConsentUrl(next));
      return;
    }
    window.location.replace(next);
  };

  const switchAccount = async () => {
    if (busy) return;
    setBusy(true);
    clearAuthConfirm();
    try {
      const { isSupabaseConfigured } = await import("@/lib/supabase/config");
      if (isSupabaseConfigured()) {
        const { createSupabaseBrowserClient } = await import(
          "@/lib/supabase/client"
        );
        await createSupabaseBrowserClient().auth.signOut({ scope: "local" });
      }
    } catch {
      /* continue */
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
      const { clearAuthStorageOnly } = await import(
        "@/lib/auth/clearAuthStorage"
      );
      clearAuthStorageOnly();
    } catch {
      /* ignore */
    }
    window.location.replace(`${APP_HOME_PATH}?login=1`);
  };

  if (!ready || !payload) {
    return (
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-white/10 bg-black/40 p-8 text-center text-sm text-white/60">
        계정 정보를 확인하는 중…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-md sm:p-8">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
          이 계정으로 로그인할까요?
        </h1>
        <p className="text-sm leading-relaxed text-white/60">
          소셜 로그인에 사용된 계정입니다. 다른 사람이면 「다른 계정」을 눌러
          다시 선택하세요.
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.07] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-200/80">
          {providerLabel(payload.provider)}
        </p>
        <p className="mt-2 text-lg font-semibold text-white">
          {payload.name || "이름 없음"}
        </p>
        <p className="mt-1 break-all text-sm text-white/70">
          {payload.email || "이메일 없음"}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={busy}
          onClick={continueWithAccount}
          className="flex-1 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-60"
        >
          이 계정으로 계속
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void switchAccount()}
          className="flex-1 rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
        >
          다른 계정
        </button>
      </div>
    </div>
  );
}
