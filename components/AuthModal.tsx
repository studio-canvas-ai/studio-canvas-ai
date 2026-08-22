"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { signIn } from "next-auth/react";
import { useI18n } from "@/components/I18nProvider";
import { useCredits, type SocialProviderId } from "@/components/CreditsProvider";
import { clearPendingCheckout } from "@/lib/pendingCheckout";
import {
  getSupabaseConfigError,
  isSupabaseConfigured,
} from "@/lib/supabase/config";
import {
  signInWithSupabaseOAuth,
  signInWithMicrosoft,
  signInWithFacebook,
  signInWithGoogle,
  signInWithKakao,
  signInWithNaver,
  peekAuthNextPath,
  consumeAuthNextPath,
} from "@/lib/supabase/oauth";
import { consumeStashedAuthError, formatOAuthError } from "@/lib/supabase/oauthErrors";
import {
  bridgeSupabaseAccessToken,
  finalizeTermsIfNeeded,
  isValidEmailFormat,
  signInWithEmailPassword,
  signUpWithEmailPassword,
  validatePasswordStrength,
} from "@/lib/supabase/emailAuth";
import { buildTermsConsentUrl } from "@/lib/termsConsent";

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function MicrosoftLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 23 23" aria-hidden="true">
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#00A4EF" d="M12 1h10v10H12z" />
      <path fill="#7FBA00" d="M1 12h10v10H1z" />
      <path fill="#FFB900" d="M12 12h10v10H12z" />
    </svg>
  );
}

function FacebookLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.95h-1.51c-1.49 0-1.95.93-1.95 1.87v2.25h3.32l-.53 3.49h-2.79V24C19.61 23.09 24 18.1 24 12.07z"
      />
    </svg>
  );
}

function InstagramLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="url(#igBrush)" />
      <defs>
        <linearGradient id="igBrush" x1="0" y1="24" x2="24" y2="0">
          <stop stopColor="#feda75" />
          <stop offset="0.5" stopColor="#d62976" />
          <stop offset="1" stopColor="#4f5bd5" />
        </linearGradient>
      </defs>
      <path
        fill="#fff"
        d="M12 7.2A4.8 4.8 0 1 0 12 16.8 4.8 4.8 0 0 0 12 7.2zm0 7.9a3.1 3.1 0 1 1 0-6.2 3.1 3.1 0 0 1 0 6.2zm5.1-8.4a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0zM12 4.5c-2 0-2.3 0-3.1.1-2.1.1-3.2 1.2-3.3 3.3-.1.8-.1 1-.1 3.1s0 2.3.1 3.1c.1 2.1 1.2 3.2 3.3 3.3.8.1 1 .1 3.1.1s2.3 0 3.1-.1c2.1-.1 3.2-1.2 3.3-3.3.1-.8.1-1 .1-3.1s0-2.3-.1-3.1c-.1-2.1-1.2-3.2-3.3-3.3-.8-.1-1.1-.1-3.1-.1zm0-1.5c2.1 0 2.3 0 3.2.1 2.8.1 4.2 1.5 4.3 4.3.1.9.1 1.1.1 3.2s0 2.3-.1 3.2c-.1 2.8-1.5 4.2-4.3 4.3-.9.1-1.1.1-3.2.1s-2.3 0-3.2-.1c-2.8-.1-4.2-1.5-4.3-4.3C4.5 14.3 4.5 14.1 4.5 12s0-2.3.1-3.2c.1-2.8 1.5-4.2 4.3-4.3.9-.1 1.1-.1 3.1-.1z"
      />
    </svg>
  );
}

function KakaoLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#3C1E1E"
        d="M12 3C6.48 3 2 6.58 2 11c0 2.84 1.88 5.33 4.7 6.76-.15.55-.97 3.5-1 3.66-.04.2.08.2.17.14.12-.08 1.9-1.3 2.67-1.82.8.2 1.63.3 2.46.3 5.52 0 10-3.58 10-8S17.52 3 12 3z"
      />
    </svg>
  );
}

function NaverLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.273 12.845 7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727v12.845z"
      />
    </svg>
  );
}

/** Exact display order required by product spec */
const SOCIAL_ORDER: SocialProviderId[] = [
  "google",
  "microsoft",
  "facebook",
  "instagram",
  "kakao",
  "naver",
];

export default function AuthModal() {
  const { t } = useI18n();
  const {
    showAuthModal,
    setShowAuthModal,
    pendingPlanId,
    setShowPaymentModal,
    refreshAccount,
    socialProviders,
  } = useCredits();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!showAuthModal) return;
    const stashed = consumeStashedAuthError();
    setError(stashed);
    setBusy(false);
    setMode("signup");
    setAgreed(false);
    setEmail("");
    setName("");
    setPassword("");
  }, [showAuthModal]);

  if (!showAuthModal) return null;

  const resolveAuthNext = () =>
    pendingPlanId ? "/pricing" : peekAuthNextPath("/");

  /** Soft success: close modal + refresh nav without forcing a full navigation. */
  const afterAuthSoft = async () => {
    setShowAuthModal(false);
    if (pendingPlanId) {
      setShowPaymentModal(true);
      await refreshAccount?.();
      return;
    }
    clearPendingCheckout();
    await refreshAccount?.();
    try {
      const raw = sessionStorage.getItem("sca_auth_next");
      if (raw && raw.startsWith("/") && !raw.startsWith("//")) {
        sessionStorage.removeItem("sca_auth_next");
        const current = `${window.location.pathname}${window.location.search}`;
        if (raw !== current) {
          window.location.href = raw;
        }
      }
    } catch {
      /* ignore */
    }
  };

  /** OAuth / hard redirect path (unchanged for social providers). */
  const afterAuth = async () => {
    setShowAuthModal(false);
    if (pendingPlanId) {
      setShowPaymentModal(true);
      await refreshAccount?.();
      return;
    }
    clearPendingCheckout();
    await refreshAccount?.();
    window.location.href = consumeAuthNextPath("/");
  };

  const mapEmailAuthError = (code: string, fallback: string) => {
    switch (code) {
      case "email_exists":
        return t.auth.emailExists;
      case "invalid_credentials":
        return t.auth.invalidCredentials;
      case "email_not_confirmed":
        return t.auth.emailNotConfirmed;
      case "network":
        return t.auth.networkError;
      default:
        return fallback;
    }
  };

  const completeWithAccessToken = async (
    accessToken: string,
    opts: { finalizeTerms: boolean }
  ) => {
    const bridged = await bridgeSupabaseAccessToken(accessToken);
    if (!bridged.ok) {
      setError(
        mapEmailAuthError(
          bridged.error === "network" ? "network" : "auth_error",
          mode === "signup" ? t.auth.signupFailed : t.auth.loginFailed
        )
      );
      return false;
    }

    if (bridged.needsTermsConsent) {
      if (opts.finalizeTerms) {
        const agreedOk = await finalizeTermsIfNeeded();
        if (!agreedOk) {
          window.location.href = buildTermsConsentUrl(resolveAuthNext());
          return true;
        }
        // /api/terms/agree already minted the full app session cookie.
      } else {
        window.location.href = buildTermsConsentUrl(resolveAuthNext());
        return true;
      }
    }

    await afterAuthSoft();
    return true;
  };

  const handleMicrosoftLogin = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = resolveAuthNext();
      const { error: oauthError } = await signInWithMicrosoft(next);
      if (oauthError) {
        console.error("마이크로소프트 로그인 오류:", oauthError.message);
        setError(
          oauthError.message ||
            "로그인 중 문제가 발생했습니다. 설정을 다시 확인해 주세요."
        );
        setBusy(false);
        return;
      }
      // Browser navigates to Microsoft; keep busy state.
    } catch (err) {
      console.error("예기치 못한 오류가 발생했습니다:", err);
      const message = err instanceof Error ? err.message : t.auth.providerUnavailable;
      setError(message);
      setBusy(false);
    }
  };

  /** Meta unified login (Facebook provider) — also used by the Instagram button. */
  const handleMetaLogin = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = resolveAuthNext();
      const { error: oauthError } = await signInWithFacebook(next);
      if (oauthError) {
        console.error("Meta/Facebook login error:", oauthError.message);
        setError(
          oauthError.message ||
            "Meta sign-in failed. Please try again or use another method."
        );
        setBusy(false);
        return;
      }
      // Browser navigates to Meta; keep busy state.
    } catch (err) {
      const message = err instanceof Error ? err.message : t.auth.providerUnavailable;
      console.error("Meta/Facebook login error:", message);
      setError(message);
      setBusy(false);
    }
  };

  const handleFacebookLogin = handleMetaLogin;

  const handleGoogleLogin = async () => {
    setBusy(true);
    setError(null);
    try {
      // Google is Supabase Auth only (not NextAuth /api/auth/callback/google).
      if (!isSupabaseConfigured()) {
        setError(
          getSupabaseConfigError() ||
            "Supabase Auth is not configured for Google login."
        );
        setBusy(false);
        return;
      }
      const next = resolveAuthNext();
      const { error: oauthError } = await signInWithGoogle(next);
      if (oauthError) {
        console.error("Google login error:", oauthError.message);
        setError(oauthError.message);
        setBusy(false);
        return;
      }
      // Browser navigates to Google; keep busy state.
    } catch (err) {
      const message = err instanceof Error ? err.message : t.auth.providerUnavailable;
      console.error("Google login error:", message);
      setError(message);
      setBusy(false);
    }
  };

  const handleKakaoLogin = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = resolveAuthNext();
      const { error: oauthError } = await signInWithKakao(next);
      if (oauthError) {
        const message = formatOAuthError(oauthError.message);
        console.error("카카오 로그인 에러:", message);
        setError(message);
        setBusy(false);
        return;
      }
      // Browser navigates to Kakao; keep busy state.
    } catch (err) {
      const message = formatOAuthError(
        err instanceof Error ? err.message : t.auth.providerUnavailable
      );
      console.error("카카오 로그인 에러:", message);
      setError(message);
      setBusy(false);
    }
  };

  const handleNaverLogin = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = resolveAuthNext();
      const { error: oauthError } = await signInWithNaver(next);
      if (oauthError) {
        console.error("로그인 에러:", oauthError.message);
        setError(oauthError.message);
        setBusy(false);
        return;
      }
      // Browser navigates to Naver; keep busy state.
    } catch (err) {
      const message = err instanceof Error ? err.message : t.auth.providerUnavailable;
      console.error("로그인 에러:", message);
      setError(message);
      setBusy(false);
    }
  };

  const handleSocial = async (provider: SocialProviderId) => {
    if (provider === "google") {
      await handleGoogleLogin();
      return;
    }
    if (provider === "microsoft") {
      await handleMicrosoftLogin();
      return;
    }
    if (provider === "facebook" || provider === "instagram") {
      await handleMetaLogin();
      return;
    }
    if (provider === "kakao") {
      await handleKakaoLogin();
      return;
    }
    if (provider === "naver") {
      await handleNaverLogin();
      return;
    }

    setBusy(true);
    setError(null);

    // Primary path: Supabase OAuth when configured.
    if (isSupabaseConfigured()) {
      try {
        const next = resolveAuthNext();
        const { error: oauthError } = await signInWithSupabaseOAuth(provider, next);
        if (oauthError) throw oauthError;
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : t.auth.providerUnavailable;
        console.error("로그인 에러:", message);
        setError(message);
        setBusy(false);
        return;
      }
    }

    // Legacy Auth.js providers (env-based) when Supabase is absent.
    if (!socialProviders.includes(provider)) {
      setError(t.auth.providerUnavailable);
      setBusy(false);
      return;
    }
    const callbackUrl = resolveAuthNext();
    await signIn(provider, { callbackUrl });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const trimmedEmail = email.trim();
    const trimmedName = name.trim();

    if (!trimmedEmail) {
      setError(t.auth.emailRequired);
      setBusy(false);
      return;
    }
    if (!isValidEmailFormat(trimmedEmail)) {
      setError(t.auth.emailInvalid);
      setBusy(false);
      return;
    }
    if (!password) {
      setError(t.auth.passwordRequired);
      setBusy(false);
      return;
    }
    if (password.length < 8) {
      setError(t.auth.passwordTooShort);
      setBusy(false);
      return;
    }
    if (!validatePasswordStrength(password)) {
      setError(t.auth.passwordWeak);
      setBusy(false);
      return;
    }

    if (mode === "signup") {
      if (!trimmedName) {
        setError(t.auth.nameRequired);
        setBusy(false);
        return;
      }
      if (!agreed) {
        setError(t.auth.termsRequired);
        setBusy(false);
        return;
      }
    }

    try {
      // Primary path: Supabase Auth email/password → app session bridge
      if (isSupabaseConfigured()) {
          if (mode === "signup") {
          const result = await signUpWithEmailPassword({
            email: trimmedEmail,
            password,
            name: trimmedName,
          });
          if (!result.ok) {
            setError(
              mapEmailAuthError(
                result.code,
                result.message || t.auth.signupFailed
              )
            );
            return;
          }
          if ("accessToken" in result) {
            await completeWithAccessToken(result.accessToken, {
              finalizeTerms: true,
            });
          }
          return;
        }

        const result = await signInWithEmailPassword({
          email: trimmedEmail,
          password,
        });
        if (!result.ok) {
          setError(
            mapEmailAuthError(result.code, result.message || t.auth.loginFailed)
          );
          return;
        }
        if ("accessToken" in result) {
          await completeWithAccessToken(result.accessToken, {
            finalizeTerms: false,
          });
        }
        return;
      }

      // Dev / demo fallback when Supabase is not configured
      const res = await signIn("credentials", {
        email: trimmedEmail,
        password,
        name: trimmedName,
        redirect: false,
      });
      if (res?.error) {
        setError(
          getSupabaseConfigError() ||
            (mode === "signup" ? t.auth.signupFailed : t.auth.loginFailed)
        );
        return;
      }
      await afterAuthSoft();
    } catch (err) {
      console.error("[AuthModal] email auth failed:", err);
      setError(t.auth.networkError);
    } finally {
      setBusy(false);
    }
  };

  const socialConfig: Record<
    SocialProviderId,
    { label: string; className: string; icon: ReactNode }
  > = {
    google: {
      label: t.auth.continueWithGoogle,
      className:
        "gap-3.5 border-0 bg-[linear-gradient(90deg,#F29100_0%,#FFC107_32%,#9CCC65_68%,#2E7D32_100%)] text-[18px] !font-bold leading-none tracking-tight text-[#0056B3] shadow-sm hover:brightness-105 hover:shadow sm:text-[19px]",
      icon: <GoogleLogo className="h-7 w-7 shrink-0 text-white sm:h-8 sm:w-8" />,
    },
    microsoft: {
      label: t.auth.continueWithMicrosoft,
      className:
        "gap-3.5 border border-slate-300 bg-white text-[18px] !font-bold leading-none tracking-tight text-slate-900 hover:bg-slate-50 sm:text-[19px]",
      icon: <MicrosoftLogo className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" />,
    },
    facebook: {
      label: t.auth.continueWithFacebook,
      className:
        "gap-3.5 border border-[#1877F2]/40 bg-[#1877F2] text-[18px] !font-bold leading-none tracking-tight text-white shadow-sm hover:bg-[#166fe5] hover:shadow sm:text-[19px]",
      icon: <FacebookLogo className="h-7 w-7 shrink-0 text-white sm:h-8 sm:w-8" />,
    },
    instagram: {
      label: t.auth.continueWithInstagram,
      className:
        "gap-3.5 border border-pink-200/80 bg-white text-[18px] !font-bold leading-none tracking-tight text-slate-900 hover:bg-slate-50 sm:text-[19px]",
      icon: <InstagramLogo className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" />,
    },
    kakao: {
      label: t.auth.continueWithKakao,
      className:
        "gap-3.5 bg-[#FEE500] text-[18px] !font-bold leading-none tracking-tight text-[#191919] hover:bg-[#f5dc00] sm:text-[19px]",
      icon: <KakaoLogo className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" />,
    },
    naver: {
      label: t.auth.continueWithNaver,
      className:
        "gap-3.5 bg-[#03C75A] text-[18px] !font-bold leading-none tracking-tight text-white hover:bg-[#02b350] sm:text-[19px]",
      icon: <NaverLogo className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" />,
    },
  };

  const inputClass =
    "w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-navy/70 backdrop-blur-sm"
        aria-label="Close"
        onClick={() => setShowAuthModal(false)}
      />
      <div className="relative z-10 flex max-h-[min(94vh,920px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <button
          type="button"
          onClick={() => setShowAuthModal(false)}
          className="absolute top-3 right-3 z-10 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 sm:top-4 sm:right-4"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="overflow-y-auto px-6 py-8 sm:px-10 sm:py-10">
          <header className="mb-7 text-center sm:mb-8">
            <h2 className="text-[1.35rem] font-semibold tracking-tight text-slate-900 sm:text-2xl">
              {t.auth.welcomeTitle}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {pendingPlanId ? t.payment.subtitle : t.auth.subtitle}
            </p>
          </header>

          <div className="space-y-3">
            {SOCIAL_ORDER.map((id) => {
              const cfg = socialConfig[id];
              return (
                <button
                  key={id}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (id === "microsoft") {
                      void handleMicrosoftLogin();
                      return;
                    }
                    if (id === "facebook" || id === "instagram") {
                      void handleMetaLogin();
                      return;
                    }
                    if (id === "kakao") {
                      void handleKakaoLogin();
                      return;
                    }
                    if (id === "naver") {
                      void handleNaverLogin();
                      return;
                    }
                    void handleSocial(id);
                  }}
                  className={`flex w-full items-center justify-center rounded-xl px-4 py-3.5 font-semibold transition disabled:opacity-50 sm:py-3.5 ${cfg.className}`}
                >
                  {cfg.icon}
                  <span className="leading-none">{cfg.label}</span>
                </button>
              );
            })}
          </div>

          <div className="my-8">
            <h3 className="text-base font-bold text-slate-900">{t.auth.signupWithEmail}</h3>
          </div>

          {error && (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-600">
              {error}
            </p>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3.5">
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder={t.auth.emailPlaceholder}
              aria-label={t.auth.email}
            />
            {mode === "signup" && (
              <input
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                placeholder={t.auth.namePlaceholder}
                aria-label={t.auth.name}
              />
            )}
            <input
              type="password"
              required
              minLength={8}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder={t.auth.passwordPlaceholder}
              aria-label={t.auth.password}
            />

            {mode === "signup" && (
              <label className="flex cursor-pointer items-start gap-2.5 pt-1 text-sm leading-snug text-slate-600">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-sky-500 focus:ring-sky-400"
                />
                <span>
                  {t.auth.agreeTermsPrefix}{" "}
                  <Link
                    href="/terms"
                    target="_blank"
                    className="font-medium text-violet-700 underline underline-offset-2 hover:text-violet-900"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {t.auth.termsOfService}
                  </Link>{" "}
                  {t.auth.agreeTermsAnd}{" "}
                  <Link
                    href="/privacy"
                    target="_blank"
                    className="font-medium text-violet-700 underline underline-offset-2 hover:text-violet-900"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {t.auth.privacyPolicy}
                  </Link>
                </span>
              </label>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-2 w-full rounded-xl bg-[#5B8DEF] py-3.5 text-base font-semibold text-white transition hover:bg-[#4a7de0] disabled:opacity-50 sm:py-4"
            >
              {mode === "signup" ? t.auth.signup : t.auth.login}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode((m) => (m === "signup" ? "login" : "signup"));
              setError(null);
            }}
            className="mt-5 w-full text-center text-sm text-slate-500 transition hover:text-slate-800"
          >
            {mode === "signup" ? t.auth.switchToLogin : t.auth.switchToSignup}
          </button>

          {!pendingPlanId && (
            <button
              type="button"
              onClick={() => {
                setShowAuthModal(false);
                clearPendingCheckout();
                window.location.href = "/generate";
              }}
              className="mt-3 w-full text-center text-xs text-slate-400 transition hover:text-slate-600"
            >
              {t.auth.skipToGenerate}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
