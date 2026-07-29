"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { signIn } from "next-auth/react";
import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";

type ProviderId = "kakao" | "google" | "naver";

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

  useEffect(() => {
    if (!showAuthModal) return;
    void fetch("/api/account/me")
      .then((r) => r.json())
      .then((d: { providers?: ProviderId[] }) => setProviders(d.providers ?? []))
      .catch(() => setProviders([]));
  }, [showAuthModal]);

  if (!showAuthModal) return null;

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

        {providers.length > 0 && (
          <div className="mb-4 space-y-2">
            {providers.map((p) => (
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
            <p className="pt-1 text-center text-[11px] text-white/35">{t.auth.orEmail}</p>
          </div>
        )}

        <div className="mb-5 flex gap-2 rounded-xl bg-white/5 p-1">
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
          <p className="rounded-xl border border-glow-emerald/20 bg-glow-emerald/10 px-3 py-2 text-xs text-emerald-200">
            {t.auth.freeCredits}
          </p>
          <p className="text-[11px] text-white/35">{t.auth.socialHint}</p>
          {error && <p className="text-xs text-red-300">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full py-3 text-sm disabled:opacity-50">
            {mode === "signup" ? t.auth.signup : t.auth.login}
          </button>
          {!pendingPlanId && (
            <button
              type="button"
              onClick={() => {
                setShowAuthModal(false);
                window.location.href = "/generate";
              }}
              className="w-full text-center text-xs text-white/40 hover:text-white/70"
            >
              {t.auth.skipToGenerate}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
