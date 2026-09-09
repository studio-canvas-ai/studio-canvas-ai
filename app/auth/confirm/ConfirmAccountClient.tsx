"use client";

import { useEffect, useState } from "react";
import {
  isBlockedLoginAccount,
  blockedLoginMessage,
  publicAccountEmail,
} from "@/lib/auth/blockedAccounts";
import {
  clearAuthConfirm,
  providerLabel,
  readAuthConfirm,
  writeAuthConfirm,
  type AuthConfirmPayload,
} from "@/lib/auth/confirmAccount";
import { buildTermsConsentUrl, safePostConsentPath } from "@/lib/termsConsent";
import { APP_HOME_PATH } from "@/lib/appRoutes";

/**
 * Must stay free of CreditsProvider / I18nProvider — /auth/* uses AuthShell.
 */
export default function ConfirmAccountClient({
  nextPath,
}: {
  nextPath: string;
}) {
  const [payload, setPayload] = useState<AuthConfirmPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        let stored = readAuthConfirm();

        // sessionStorage miss (rare) — rebuild from provisional JWT via /api/account/me
        if (!stored) {
          try {
            const res = await fetch("/api/account/me", {
              cache: "no-store",
              credentials: "same-origin",
            });
            const data = (await res.json().catch(() => ({}))) as {
              pendingTermsConsent?: boolean;
              pendingIdentity?: {
                email?: string | null;
                name?: string | null;
                image?: string | null;
                provider?: string | null;
              } | null;
              blockedLogin?: boolean;
              error?: string;
            };
            if (data.blockedLogin) {
              if (!cancelled) {
                setBlocked(true);
                setPayload({
                  email: data.pendingIdentity?.email ?? "hercd@hanmail.net",
                  name: data.pendingIdentity?.name ?? null,
                  image: data.pendingIdentity?.image ?? null,
                  provider: data.pendingIdentity?.provider || "naver",
                  needsTermsConsent: true,
                  next: safePostConsentPath(nextPath),
                  at: Date.now(),
                });
                setReady(true);
              }
              return;
            }
            if (data.pendingIdentity) {
              stored = {
                email: data.pendingIdentity.email ?? null,
                name: data.pendingIdentity.name ?? null,
                image: data.pendingIdentity.image ?? null,
                provider: data.pendingIdentity.provider || "unknown",
                needsTermsConsent: Boolean(data.pendingTermsConsent),
                next: safePostConsentPath(nextPath),
                at: Date.now(),
              };
              writeAuthConfirm(stored);
            }
          } catch {
            /* fall through */
          }
        }

        if (cancelled) return;

        if (!stored) {
          window.location.replace(safePostConsentPath(nextPath));
          return;
        }

        const next = safePostConsentPath(stored.next || nextPath);
        if (
          isBlockedLoginAccount({
            email: stored.email,
            provider: stored.provider,
          })
        ) {
          setBlocked(true);
        }
        setPayload({ ...stored, next });
        setReady(true);
      } catch (err) {
        if (cancelled) return;
        setLoadError(
          err instanceof Error ? err.message : "계정 확인 화면을 열 수 없습니다."
        );
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [nextPath]);

  const continueWithAccount = () => {
    if (!payload || busy || blocked) return;
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

  if (!ready) {
    return (
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-white/10 bg-black/40 p-8 text-center text-sm text-white/60">
        계정 정보를 확인하는 중…
      </div>
    );
  }

  if (loadError || !payload) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-4 rounded-2xl border border-red-400/30 bg-black/40 p-8 text-center">
        <p className="text-sm text-red-300">
          {loadError || "계정 정보를 불러오지 못했습니다."}
        </p>
        <button
          type="button"
          onClick={() => void switchAccount()}
          className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-semibold text-white"
        >
          다시 로그인
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-md sm:p-8">
      <div className="space-y-2">
        <p className="text-sm font-semibold tracking-wide text-emerald-300/90">
          Studio Canvas AI
        </p>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">
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
          {publicAccountEmail(payload.email, {
            provider: payload.provider,
          }) || "이메일 없음"}
        </p>
      </div>

      {blocked ? (
        <p
          role="alert"
          className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
        >
          {blockedLoginMessage("kr")}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        {!blocked ? (
          <button
            type="button"
            disabled={busy}
            onClick={continueWithAccount}
            className="flex-1 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-60"
          >
            이 계정으로 계속
          </button>
        ) : null}
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
