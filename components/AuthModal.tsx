"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";

export default function AuthModal() {
  const { t } = useI18n();
  const {
    showAuthModal,
    setShowAuthModal,
    grantFreeCredits,
    pendingPlanId,
    setShowPaymentModal,
  } = useCredits();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (!showAuthModal) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    grantFreeCredits();
    if (pendingPlanId) {
      setShowPaymentModal(true);
      return;
    }
    window.location.href = "/generate";
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

        <form onSubmit={handleSubmit} className="space-y-4">
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
          <button type="submit" className="btn-primary w-full py-3 text-sm">
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
