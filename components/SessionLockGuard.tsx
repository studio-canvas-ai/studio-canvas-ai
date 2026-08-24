"use client";

/**
 * Enforces one active browser session per signed-in member.
 * Privileged admin emails skip claim/poll entirely.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useCredits } from "@/components/CreditsProvider";
import { useFeedback } from "@/components/FeedbackProvider";
import {
  isSessionLockExemptEmail,
  SESSION_LOCK_EVENT,
  SESSION_LOCK_REVOKED_MESSAGE,
  SESSION_LOCK_STORAGE_KEY,
} from "@/lib/auth/sessionLockShared";

const POLL_MS = 20_000;

function readLocalSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_LOCK_STORAGE_KEY);
    return raw && raw.trim() ? raw.trim() : null;
  } catch {
    return null;
  }
}

function writeLocalSessionId(id: string): void {
  try {
    localStorage.setItem(SESSION_LOCK_STORAGE_KEY, id);
  } catch {
    /* ignore quota */
  }
}

function clearLocalSessionId(): void {
  try {
    localStorage.removeItem(SESSION_LOCK_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function newSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function getOrCreateLocalSessionId(): string {
  const existing = readLocalSessionId();
  if (existing) return existing;
  const next = newSessionId();
  writeLocalSessionId(next);
  return next;
}

export default function SessionLockGuard() {
  const { isAuthenticated, authUser, isAdmin, signOutUser } = useCredits();
  const { showToast, confirm } = useFeedback();
  const [busy, setBusy] = useState(false);
  const kickedRef = useRef(false);
  const claimedForRef = useRef<string | null>(null);

  const revokeAndLogout = useCallback(async () => {
    if (kickedRef.current) return;
    kickedRef.current = true;
    clearLocalSessionId();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(SESSION_LOCK_EVENT));
    }
    showToast(SESSION_LOCK_REVOKED_MESSAGE, "error");
    try {
      await confirm({
        title: "세션 종료",
        message: SESSION_LOCK_REVOKED_MESSAGE,
        confirmLabel: "확인",
        cancelLabel: "닫기",
        tone: "danger",
      });
    } catch {
      /* ignore */
    }
    await signOutUser();
  }, [confirm, showToast, signOutUser]);

  const checkSession = useCallback(async () => {
    if (!isAuthenticated || kickedRef.current) return;
    const email = authUser?.email ?? null;
    if (isAdmin || isSessionLockExemptEmail(email)) return;

    const sessionId = readLocalSessionId();
    if (!sessionId) return;

    try {
      const res = await fetch(
        `/api/auth/session-lock?sessionId=${encodeURIComponent(sessionId)}`,
        { method: "GET", credentials: "same-origin", cache: "no-store" }
      );
      if (res.status === 401) return;
      if (!res.ok) return;
      const data = (await res.json()) as {
        valid?: boolean;
        exempt?: boolean;
      };
      if (data.exempt) return;
      if (data.valid === false) {
        await revokeAndLogout();
      }
    } catch {
      /* network — keep session */
    }
  }, [authUser?.email, isAdmin, isAuthenticated, revokeAndLogout]);

  const claimSession = useCallback(async () => {
    if (!isAuthenticated || busy || kickedRef.current) return;
    const email = authUser?.email ?? null;
    if (isAdmin || isSessionLockExemptEmail(email)) {
      clearLocalSessionId();
      return;
    }

    const accountKey = `${authUser?.id || ""}:${email || ""}`;
    const sessionId = getOrCreateLocalSessionId();

    // Re-claim when account changes; keep same id across refreshes.
    if (claimedForRef.current === accountKey) {
      await checkSession();
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/session-lock", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (res.status === 401) return;
      if (!res.ok) return;
      const data = (await res.json()) as { ok?: boolean; exempt?: boolean };
      if (data.exempt) {
        clearLocalSessionId();
        return;
      }
      if (data.ok) {
        claimedForRef.current = accountKey;
        writeLocalSessionId(sessionId);
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }, [authUser?.email, authUser?.id, busy, checkSession, isAdmin, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      claimedForRef.current = null;
      kickedRef.current = false;
      return;
    }
    void claimSession();
  }, [claimSession, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const email = authUser?.email ?? null;
    if (isAdmin || isSessionLockExemptEmail(email)) return;

    const timer = window.setInterval(() => {
      void checkSession();
    }, POLL_MS);

    const onFocus = () => {
      void checkSession();
    };
    const onVis = () => {
      if (document.visibilityState === "visible") void checkSession();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [authUser?.email, checkSession, isAdmin, isAuthenticated]);

  return null;
}

/** Clear local lock id on logout so the next login mints a fresh claim. */
export function clearSessionLockLocal(): void {
  clearLocalSessionId();
}
