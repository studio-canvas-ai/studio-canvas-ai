/**
 * Logout / session-end storage purge.
 * Never uses Storage.clear() — only removes auth/session keys via removeItem.
 * Studio persist keys (recent files, vaults, wizards) are never touched.
 */

import { isProtectedStudioStorageKey } from "@/lib/studioStore/persistKeys";
import {
  authCallbackUrlCookieName,
  authCsrfCookieName,
  authSessionCookieName,
} from "@/lib/authCookies";

function isAuthLocalOrSessionKey(key: string): boolean {
  if (isProtectedStudioStorageKey(key)) return false;
  const k = key.toLowerCase();
  if (k.startsWith("sb-")) return true;
  if (k.startsWith("supabase.auth")) return true;
  if (k.includes("authjs") || k.includes("next-auth")) return true;
  if (k === "sca_auth_next" || k === "sca_auth_error") return true;
  if (k === "sca_active_session_id") return true;
  return false;
}

export function isAuthCookieName(name: string): boolean {
  const n = name.toLowerCase();
  if (n.includes("authjs") || n.includes("next-auth")) return true;
  if (n.startsWith("sb-")) return true;
  if (n === "sca_auth_error") return true;
  if (n === "sca_admin_session") return true;
  return (
    n === authSessionCookieName().toLowerCase() ||
    n === authCsrfCookieName().toLowerCase() ||
    n === authCallbackUrlCookieName().toLowerCase()
  );
}

function removeMatchingKeys(storage: Storage, predicate: (key: string) => boolean) {
  const doomed: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key && predicate(key)) doomed.push(key);
  }
  for (const key of doomed) {
    try {
      storage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

function expireCookie(name: string) {
  const expires = "Thu, 01 Jan 1970 00:00:00 GMT";
  const variants = [
    `${name}=; Max-Age=0; path=/; SameSite=Lax`,
    `${name}=; expires=${expires}; path=/; SameSite=Lax`,
  ];
  try {
    const host = window.location.hostname;
    if (host.includes(".")) {
      variants.push(
        `${name}=; Max-Age=0; path=/; domain=${host}; SameSite=Lax`,
        `${name}=; expires=${expires}; path=/; domain=${host}; SameSite=Lax`,
        `${name}=; Max-Age=0; path=/; domain=.${host}; SameSite=Lax`
      );
    }
  } catch {
    /* ignore */
  }
  for (const value of variants) {
    try {
      document.cookie = value;
    } catch {
      /* ignore */
    }
  }
}

/** Targeted auth purge. Must never call localStorage.clear() / sessionStorage.clear(). */
export function clearAuthStorageOnly(): void {
  if (typeof window === "undefined") return;

  try {
    removeMatchingKeys(window.localStorage, isAuthLocalOrSessionKey);
  } catch {
    /* ignore */
  }
  try {
    removeMatchingKeys(window.sessionStorage, isAuthLocalOrSessionKey);
  } catch {
    /* ignore */
  }

  try {
    for (const raw of document.cookie.split(";")) {
      const name = raw.split("=")[0]?.trim();
      if (!name || !isAuthCookieName(name)) continue;
      expireCookie(name);
    }
  } catch {
    /* ignore */
  }
}
