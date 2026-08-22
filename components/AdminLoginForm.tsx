"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Login failed");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setBusy(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(91,141,239,0.18),_transparent_55%)]" />
      <div className="glass-card relative z-10 w-full max-w-md p-8 sm:p-10">
        <p className="text-xs font-medium tracking-widest text-glow-purple uppercase">
          Admin only
        </p>
        <h1 className="font-display mt-2 text-2xl font-bold text-white sm:text-3xl">
          Admin Login
        </h1>
        <p className="mt-2 text-sm text-white/50">
          Sign in with an allow-listed admin email and the server admin password
          to manage members, promotions, and support tickets.
        </p>

        <form onSubmit={(e) => void onSubmit(e)} className="mt-8 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs text-white/50">Admin email</span>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20"
              placeholder="admin@example.com"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-white/50">Admin password / token</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20"
              placeholder="••••••••"
            />
          </label>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-[#5B8DEF] py-3.5 text-sm font-semibold text-white transition hover:bg-[#4a7de0] disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in to admin"}
          </button>
        </form>
      </div>
    </main>
  );
}
