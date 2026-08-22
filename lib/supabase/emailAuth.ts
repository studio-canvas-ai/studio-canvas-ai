import type { AuthError } from "@supabase/supabase-js";
import {
  isValidEmailFormat,
  validatePasswordStrength,
} from "@/lib/authValidation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export { isValidEmailFormat, validatePasswordStrength };

export type BridgeResult =
  | { ok: true; needsTermsConsent: boolean }
  | { ok: false; error: string };

export async function bridgeSupabaseAccessToken(
  accessToken: string
): Promise<BridgeResult> {
  try {
    const res = await fetch("/api/auth/supabase-bridge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ accessToken }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      needsTermsConsent?: boolean;
    };
    if (!res.ok || !json.ok) {
      return { ok: false, error: json.error || `Session bridge failed (${res.status})` };
    }
    return { ok: true, needsTermsConsent: Boolean(json.needsTermsConsent) };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function finalizeTermsIfNeeded(): Promise<boolean> {
  try {
    const res = await fetch("/api/terms/agree", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ acceptTerms: true, acceptPrivacy: true }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export type EmailAuthResult =
  | { ok: true; accessToken: string }
  | { ok: false; code: string; message: string };

function mapAuthError(error: AuthError | null | undefined): {
  code: string;
  message: string;
} {
  const message = error?.message || "Authentication failed";
  const lower = message.toLowerCase();
  if (
    lower.includes("already registered") ||
    lower.includes("already been registered") ||
    lower.includes("user already exists") ||
    error?.code === "user_already_exists"
  ) {
    return { code: "email_exists", message };
  }
  if (
    lower.includes("invalid login credentials") ||
    lower.includes("invalid credentials") ||
    error?.code === "invalid_credentials"
  ) {
    return { code: "invalid_credentials", message };
  }
  if (lower.includes("email not confirmed")) {
    return { code: "email_not_confirmed", message };
  }
  return { code: "auth_error", message };
}

/**
 * Immediate signup: server creates a confirmed user (no email wait), then
 * browser signs in so Supabase cookies + app session are established.
 */
export async function signUpWithEmailPassword(opts: {
  email: string;
  password: string;
  name: string;
}): Promise<EmailAuthResult> {
  const email = opts.email.trim().toLowerCase();
  const name = opts.name.trim();

  try {
    const createRes = await fetch("/api/auth/email-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        email,
        password: opts.password,
        name,
      }),
    });
    const created = (await createRes.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      code?: string;
    };

    if (!createRes.ok || !created.ok) {
      const code = created.code || "auth_error";
      if (code === "email_exists") {
        return { ok: false, code: "email_exists", message: created.error || "" };
      }
      if (code === "service_unavailable") {
        // Fallback: client signUp (projects with confirm disabled still get a session).
        return signUpViaBrowserFallback(opts);
      }
      return {
        ok: false,
        code,
        message: created.error || "Sign-up failed",
      };
    }
  } catch {
    // Network / API failure — try browser path so review signup is not blocked.
    return signUpViaBrowserFallback(opts);
  }

  // Confirmed account exists — establish browser session immediately.
  const signedIn = await signInWithEmailPassword({
    email,
    password: opts.password,
  });
  if (signedIn.ok) return signedIn;

  // Rare race: confirm succeeded but password sign-in lagged — one soft retry.
  if (signedIn.code === "email_not_confirmed" || signedIn.code === "invalid_credentials") {
    await new Promise((r) => setTimeout(r, 400));
    return signInWithEmailPassword({ email, password: opts.password });
  }
  return signedIn;
}

async function signUpViaBrowserFallback(opts: {
  email: string;
  password: string;
  name: string;
}): Promise<EmailAuthResult> {
  try {
    const supabase = createSupabaseBrowserClient();
    const email = opts.email.trim().toLowerCase();
    const name = opts.name.trim();

    const { data, error } = await supabase.auth.signUp({
      email,
      password: opts.password,
      options: {
        data: { name, full_name: name },
      },
    });

    if (error) {
      return { ok: false, ...mapAuthError(error) };
    }

    if (data.session?.access_token) {
      return { ok: true, accessToken: data.session.access_token };
    }

    // Confirmation still required in project settings — try password login anyway
    // (auto-confirm may have been enabled after user creation).
    const signedIn = await signInWithEmailPassword({
      email,
      password: opts.password,
    });
    if (signedIn.ok) return signedIn;

    return {
      ok: false,
      code: "auth_error",
      message:
        "Email confirmation is still required in Supabase Auth settings, or SUPABASE_SERVICE_ROLE_KEY is missing.",
    };
  } catch (err) {
    return {
      ok: false,
      code: "network",
      message: err instanceof Error ? err.message : "network",
    };
  }
}

export async function signInWithEmailPassword(opts: {
  email: string;
  password: string;
}): Promise<EmailAuthResult> {
  try {
    const supabase = createSupabaseBrowserClient();
    const email = opts.email.trim().toLowerCase();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: opts.password,
    });

    if (error) {
      return { ok: false, ...mapAuthError(error) };
    }

    const accessToken = data.session?.access_token;
    if (!accessToken) {
      return {
        ok: false,
        code: "auth_error",
        message: "Sign-in did not return a session",
      };
    }

    return { ok: true, accessToken };
  } catch (err) {
    return {
      ok: false,
      code: "network",
      message: err instanceof Error ? err.message : "network",
    };
  }
}
