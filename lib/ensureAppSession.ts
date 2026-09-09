import { bridgeSupabaseAccessToken } from "@/lib/supabase/emailAuth";
import {
  isOnTermsConsentPath,
  redirectToTermsConsentIfNeeded,
} from "@/lib/termsConsent";

/** Browser has Supabase session but server APIs need Auth.js cookie — bridge once. */
export async function ensureAppSessionFromSupabase(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  // Already on the gate with a provisional session — do not re-bridge/reload.
  if (isOnTermsConsentPath()) return false;

  try {
    const meRes = await fetch("/api/account/me", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (meRes.ok) {
      const me = (await meRes.json().catch(() => ({}))) as {
        authenticated?: boolean;
        pendingTermsConsent?: boolean;
      };
      if (me.authenticated) return true;
      if (me.pendingTermsConsent) {
        redirectToTermsConsentIfNeeded(window.location.pathname);
        return false;
      }
    }
  } catch {
    /* fall through to bridge */
  }

  try {
    const { isSupabaseConfigured } = await import("@/lib/supabase/config");
    if (!isSupabaseConfigured()) return false;

    const { createSupabaseBrowserClient } = await import("@/lib/supabase/client");
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token?.trim();
    if (!accessToken) return false;

    const bridge = await bridgeSupabaseAccessToken(accessToken);
    if (!bridge.ok) return false;

    if (bridge.needsTermsConsent) {
      redirectToTermsConsentIfNeeded(window.location.pathname);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
