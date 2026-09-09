/**
 * Post-OAuth identity confirmation — stop users from entering the wrong account
 * when the IdP reused a sticky social session.
 */

import { APP_HOME_PATH } from "@/lib/appRoutes";
import { safePostConsentPath } from "@/lib/termsConsent";

export const AUTH_CONFIRM_KEY = "sca_auth_confirm_v1";

export type AuthConfirmPayload = {
  email: string | null;
  name: string | null;
  image: string | null;
  provider: string;
  needsTermsConsent: boolean;
  next: string;
  at: number;
};

export function buildAuthConfirmUrl(nextPath: string): string {
  const next = safePostConsentPath(nextPath);
  return `/auth/confirm?next=${encodeURIComponent(next)}`;
}

export function writeAuthConfirm(payload: AuthConfirmPayload) {
  try {
    sessionStorage.setItem(AUTH_CONFIRM_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function readAuthConfirm(): AuthConfirmPayload | null {
  try {
    const raw = sessionStorage.getItem(AUTH_CONFIRM_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthConfirmPayload;
    if (!parsed || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > 30 * 60 * 1000) {
      sessionStorage.removeItem(AUTH_CONFIRM_KEY);
      return null;
    }
    return {
      ...parsed,
      next: safePostConsentPath(parsed.next, APP_HOME_PATH),
    };
  } catch {
    return null;
  }
}

export function clearAuthConfirm() {
  try {
    sessionStorage.removeItem(AUTH_CONFIRM_KEY);
  } catch {
    /* ignore */
  }
}

export function providerLabel(provider: string | null | undefined): string {
  const p = (provider || "").toLowerCase();
  if (p.includes("naver")) return "Naver";
  if (p.includes("kakao")) return "Kakao";
  if (p.includes("google")) return "Google";
  if (p.includes("microsoft") || p.includes("azure")) return "Microsoft";
  if (p.includes("facebook")) return "Facebook";
  if (p.includes("instagram")) return "Instagram";
  if (p.includes("credential") || p === "email") return "Email";
  return provider?.trim() || "Unknown";
}
