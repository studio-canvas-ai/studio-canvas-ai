"use client";

import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { useCredits } from "@/components/CreditsProvider";
import { useI18n } from "@/components/I18nProvider";

export default function PromotionCodeModal() {
  const { t } = useI18n();
  const {
    showPromoModal,
    setShowPromoModal,
    refreshAccount,
    promoWallet,
  } = useCredits();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!showPromoModal) return null;
  const activate = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/promotions/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(
          result.error === "code_expired"
            ? t.promotion.expired
            : t.promotion.invalid
        );
      }
      await refreshAccount();
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.promotion.activationFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={() => setShowPromoModal(false)}
        className="absolute inset-0 bg-navy/80 backdrop-blur-sm"
      />
      <div className="glass-card relative z-10 w-full max-w-sm p-6">
        <button
          type="button"
          onClick={() => setShowPromoModal(false)}
          className="absolute right-4 top-4 p-1.5 text-white/40 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="text-lg font-semibold">{t.promotion.title}</h2>
        <p className="mt-1 text-xs text-white/45">
          {t.promotion.description}
        </p>

        {promoWallet && (
          <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3">
            <p className="text-xs text-emerald-200/70">
              {t.promotion.currentCredits}
            </p>
            <p className="mt-1 text-xl font-semibold text-emerald-100">
              {promoWallet.remainingCredits}C
            </p>
          </div>
        )}

        <form onSubmit={(event) => void activate(event)} className="mt-5 space-y-3">
          <input
            autoFocus
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="SC-XXXX-XXXX-XXXX-XXXX"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm uppercase tracking-wide outline-none focus:border-glow-purple/50"
          />
          {error && <p className="text-xs text-red-300">{error}</p>}
          <button
            type="submit"
            disabled={busy || !code.trim()}
            className="btn-secondary w-full py-2.5 text-sm disabled:opacity-50"
          >
            {busy ? t.promotion.checking : t.promotion.loadCredits}
          </button>
        </form>
      </div>
    </div>
  );
}
