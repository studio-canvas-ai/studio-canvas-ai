"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildTermsConsentUrl,
  safePostConsentPath,
} from "@/lib/termsConsent";
import AuthBridgeLoading from "./AuthBridgeLoading";
import { getBridgeCopy } from "./bridgeCopy";
import { APP_HOME_PATH, appPathWithAuthError } from "@/lib/appRoutes";

const FETCH_TIMEOUT_MS = 8_000;
/** Keep retries tight — callback already exchanged the code; only cover cookie race. */
const SESSION_ATTEMPTS = 3;
const SESSION_RETRY_MS = 80;

function readNextPath(): string {
  try {
    const raw = new URLSearchParams(window.location.search).get("next");
    if (raw) return safePostConsentPath(raw);
  } catch {
    /* ignore */
  }
  try {
    const key = "sca_auth_next";
    const stored = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    if (stored) return safePostConsentPath(stored);
  } catch {
    /* ignore */
  }
  return APP_HOME_PATH;
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
  window.location.replace(appPathWithAuthError(detail || "auth_bridge_failed"));
}

async function wait(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/** Kick off Supabase client chunk as soon as this module evaluates. */
const supabaseClientPromise = import("@/lib/supabase/client");

/**
 * Client-only bridge logic. Supabase stays dynamically imported so a hung
 * module graph cannot block the inline escape script in page.tsx.
 */
export default function BridgeClient() {
  const copy = useMemo(() => getBridgeCopy(), []);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const { createSupabaseBrowserClient } = await supabaseClientPromise;
        const supabase = createSupabaseBrowserClient();

        let accessToken: string | null = null;
        let lastSessionError: string | null = null;

        // Facebook (and some mobile browsers) may write cookies a tick late.
        for (let i = 0; i < SESSION_ATTEMPTS; i++) {
          if (cancelled) return;
          const { data, error } = await supabase.auth.getSession();
          accessToken = data.session?.access_token ?? null;
          if (accessToken) break;
          lastSessionError = error?.message ?? null;
          if (i < SESSION_ATTEMPTS - 1) await wait(SESSION_RETRY_MS * (i + 1));
        }

        if (!accessToken) {
          throw new Error(
            lastSessionError ||
              "No Supabase access token after OAuth (cookies missing? Check www vs apex origin)."
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
          needsTermsConsent?: boolean;
        };

        if (!bridgeRes.ok || !bridgeJson.ok) {
          throw new Error(
            bridgeJson.error ||
              `Failed to create app session (${bridgeRes.status})`
          );
        }

        if (cancelled) return;
        markDone();
        const next = readNextPath();
        if (bridgeJson.needsTermsConsent) {
          window.location.replace(buildTermsConsentUrl(next));
          return;
        }
        window.location.replace(next);
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

  return (
    <AuthBridgeLoading
      message={copy.loading}
      errorText={errorText}
      errorTitle={copy.failed}
      redirectingLabel={copy.redirecting}
      continueLabel={copy.continue}
      onContinue={errorText ? () => failRedirect(errorText) : undefined}
    />
  );
}
