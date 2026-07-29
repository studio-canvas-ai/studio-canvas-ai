"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { signIn } from "next-auth/react";
import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";

type ProviderId = "kakao" | "google" | "naver";

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export default function AuthModal() {
  const { t } = useI18n();
  const {
    showAuthModal,
    setShowAuthModal,
    grantFreeCredits,
    pendingPlanId,
    setShowPaymentModal,
    refreshAccount,
  } = useCredits();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderId[]>([]);
  const [showEmail, setShowEmail] = useState(false);

  useEffect(() => {
    if (!showAuthModal) return;
    void fetch("/api/account/me")
      .then((r) => r.json())
      .then((d: { providers?: ProviderId[] }) => setProviders(d.providers ?? []))
      .catch(() => setProviders([]));
  }, [showAuthModal]);

  if (!showAuthModal) return null;
  const localGoogleMock =
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(window.location.hostname);

  const afterAuth = async () => {
    await refreshAccount?.();
    setShowAuthModal(false);
    if (pendingPlanId) {
      setShowPaymentModal(true);
      return;
    }
    window.location.href = "/generate";
  };

  const handleSocial = async (provider: ProviderId) => {
    setBusy(true);
    setError(null);
    const isLocalGoogle = provider === "google" && localGoogleMock;
    if (isLocalGoogle) {
      try {
        const result = await signIn("google-mock", {
          email: "test@gmail.com",
          redirect: false,
        });
        if (result?.error) throw new Error(result.error);
        await afterAuth();
      } catch {
        setError(t.auth.mockLoginHint);
      } finally {
        setBusy(false);
      }
      return;
    }
    await signIn(provider, { callbackUrl: pendingPlanId ? "/pricing" : "/generate" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        // Fallback demo path when Auth secret/session fails
        grantFreeCredits();
        await afterAuth();
        return;
      }
      await afterAuth();
    } catch {
      grantFreeCredits();
      await afterAuth();
    } finally {
      setBusy(false);
    }
  };

  const socialLabel: Record<ProviderId, string> = {
    kakao: t.auth.continueWithKakao,
    google: t.auth.continueWithGoogle,
    naver: t.auth.continueWithNaver,
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-navy/80 backdrop-blur-sm"
        aria-label="Close"
        onClick={() => setShowAuthModal(false)}
      />
      <div className="glass-card relative z-10 w-full max-w-md p-6 sm:p-8">
        <button
          type="button"
          onClick={() => setShowAuthModal(false)}
          className="absolute top-4 right-4 rounded-lg p-1.5 text-white/40 hover:bg-white/5 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-glow-purple to-glow-emerald">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">{t.auth.title}</h2>
            <p className="text-xs text-white/50">{t.auth.subtitle}</p>
          </div>
        </div>

        <p className="mb-4 rounded-xl border border-glow-emerald/20 bg-glow-emerald/10 px-3 py-2 text-center text-xs text-emerald-200">
          {t.auth.freeCredits}
        </p>

        {(localGoogleMock || providers.includes("google")) && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSocial("google")}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:opacity-50"
          >
            <GoogleLogo className="h-4 w-4" />
            {t.auth.googlePrimary}
          </button>
        )}

        {providers.filter((provider) => provider !== "google").length > 0 && (
          <div className="mt-3 space-y-2">
            {providers.filter((provider) => provider !== "google").map((p) => (
              <button
                key={p}
                type="button"
                disabled={busy}
                onClick={() => void handleSocial(p)}
                className="btn-secondary w-full py-2.5 text-sm disabled:opacity-50"
              >
                {socialLabel[p]}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowEmail((open) => !open)}
          className="mt-4 w-full text-center text-xs text-white/40 hover:text-white/70"
        >
          {t.auth.orEmail}
        </button>
        {error && <p className="mt-3 text-center text-xs text-red-300">{error}</p>}

        {showEmail && <>
        <div className="mb-5 mt-3 flex gap-2 rounded-xl bg-white/5 p-1">
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-lg py-2 text-sm transition-colors ${
              mode === "signup" ? "bg-white/10 text-white" : "text-white/40"
            }`}
          >
            {t.auth.signup}
          </button>
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 rounded-lg py-2 text-sm transition-colors ${
              mode === "login" ? "bg-white/10 text-white" : "text-white/40"
            }`}
          >
            {t.auth.login}
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs text-white/50">{t.auth.email}</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-glow-purple/40"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-white/50">{t.auth.password}</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-glow-purple/40"
            />
          </div>
          <p className="text-[11px] text-white/35">{t.auth.socialHint}</p>
          <button type="submit" disabled={busy} className="btn-primary w-full py-3 text-sm disabled:opacity-50">
            {mode === "signup" ? t.auth.signup : t.auth.login}
          </button>
        </form>
        </>}
          {!pendingPlanId && (
            <button
              type="button"
              onClick={() => {
                setShowAuthModal(false);
                window.location.href = "/generate";
              }}
              className="mt-4 w-full text-center text-xs text-white/40 hover:text-white/70"
            >
              {t.auth.skipToGenerate}
            </button>
          )}
      </div>
    </div>
  );
}
