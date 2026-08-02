"use client";

import { useEffect, useState } from "react";

const FETCH_TIMEOUT_MS = 8_000;

function readNextPath(): string {
  try {
    const raw = new URLSearchParams(window.location.search).get("next");
    if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  } catch {
    /* ignore */
  }
  try {
    const key = "sca_auth_next";
    const stored = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    if (stored && stored.startsWith("/") && !stored.startsWith("//")) return stored;
  } catch {
    /* ignore */
  }
  return "/generate";
}

function markDone() {
  try {
    (window as Window & { __scaBridgeDone?: boolean }).__scaBridgeDone = true;
  } catch {
    /* ignore */
  }
}

function failRedirect(detail: string) {
  markDone();
  window.location.replace(
    `/generate?authError=${encodeURIComponent(detail || "auth_bridge_failed")}`
  );
}

/**
 * Client-only bridge logic. Supabase is dynamically imported so a bad/hung
 * module graph cannot block the inline escape script in page.tsx.
 */
export default function BridgeClient() {
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const { createSupabaseBrowserClient } = await import(
          "@/lib/supabase/client"
        );
        const supabase = createSupabaseBrowserClient();

        const { data, error } = await supabase.auth.getSession();
        let accessToken = data.session?.access_token ?? null;

        if (!accessToken) {
          await new Promise((r) => setTimeout(r, 200));
          const retry = await supabase.auth.getSession();
          accessToken = retry.data.session?.access_token ?? null;
        }

        if (!accessToken) {
          throw new Error(
            error?.message ||
              "No Supabase access token after OAuth (cookies missing?)"
          );
        }

        const controller = new AbortController();
        const abortTimer = window.setTimeout(
          () => controller.abort(),
          FETCH_TIMEOUT_MS
        );

        let bridgeRes: Response;
        try {
          bridgeRes = await fetch("/api/auth/supabase-bridge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ accessToken }),
            signal: controller.signal,
          });
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            throw new Error("supabase-bridge fetch timed out");
          }
          throw err instanceof Error
            ? err
            : new Error("supabase-bridge fetch failed");
        } finally {
          window.clearTimeout(abortTimer);
        }

        const bridgeJson = (await bridgeRes.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        };

        if (!bridgeRes.ok || !bridgeJson.ok) {
          throw new Error(
            bridgeJson.error ||
              `Failed to create app session (${bridgeRes.status})`
          );
        }

        if (cancelled) return;
        markDone();
        window.location.replace(readNextPath());
      } catch (err) {
        if (cancelled) return;
        const detail =
          err instanceof Error ? err.message : "auth_bridge_failed";
        console.error("로그인 에러:", detail);
        setErrorText(detail);
        failRedirect(detail);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!errorText) {
    return (
      <p className="text-sm text-white/70" id="sca-bridge-status">
        Signing you in…
      </p>
    );
  }

  return (
    <>
      <p className="text-sm font-semibold text-red-400">Sign-in failed</p>
      <p className="max-w-md break-words text-sm text-red-300">{errorText}</p>
      <p className="text-xs text-white/50">Redirecting…</p>
      <button
        type="button"
        className="mt-2 rounded-lg border border-red-400/40 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
        onClick={() => failRedirect(errorText)}
      >
        Continue
      </button>
    </>
  );
}
