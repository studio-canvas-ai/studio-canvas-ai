/**
 * Supabase Auth env helpers.
 * OAuth Client ID/Secret live in the Supabase dashboard — the Next.js app only
 * needs the project URL + anon (publishable) key.
 *
 * Canonical production project (Studio Canvas AI — all social OAuth + data):
 *   ref:  oorujqbivznftsyqilyj
 *   URL:  https://oorujqbivznftsyqilyj.supabase.co
 *   OAuth IdP callback (Kakao/Google/…):
 *     https://oorujqbivznftsyqilyj.supabase.co/auth/v1/callback
 *
 * Required env (local `.env.local` + Vercel Production/Preview):
 *   NEXT_PUBLIC_SUPABASE_URL          — must be CANONICAL_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY     — publishable/anon key for that project
 *   AUTH_SECRET                       — signs NextAuth JWT after /auth/bridge
 *   NEXT_PUBLIC_SITE_URL              — canonical origin (prod: https://www.studio-canvas-ai.com)
 *   AUTH_URL / NEXTAUTH_URL           — same as site URL (local: http://localhost:3000)
 *
 * Optional (NOT used for Google when Supabase Auth is enabled):
 *   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET — Auth.js fallback only
 *   SUPABASE_SERVICE_ROLE_KEY         — admin / server jobs
 *
 * Never point production at retired test projects (see RETIRED_SUPABASE_PROJECT_REFS).
 */

/** Production Supabase project ref — all social logins and app data. */
export const CANONICAL_SUPABASE_PROJECT_REF = "oorujqbivznftsyqilyj";

/** Production Supabase Project URL. */
export const CANONICAL_SUPABASE_URL =
  `https://${CANONICAL_SUPABASE_PROJECT_REF}.supabase.co` as const;

/** IdP OAuth callback for Kakao / Google / Meta / Microsoft / Naver (Supabase Auth). */
export const CANONICAL_SUPABASE_AUTH_CALLBACK_URL =
  `${CANONICAL_SUPABASE_URL}/auth/v1/callback` as const;

/**
 * Retired / test project refs (DNS dead or abandoned).
 * If NEXT_PUBLIC_SUPABASE_URL points here, OAuth will send the wrong Kakao redirect_uri (KOE006).
 */
export const RETIRED_SUPABASE_PROJECT_REFS = [
  "ysdccsfpxduqcqxgwuy",
] as const;

const PLACEHOLDER_HOST_FRAGMENTS = [
  "your_project_ref",
  "your-project-ref",
  "project_ref",
  "xxxxxxxx",
  "example",
];

/** Origins that must appear in Supabase Auth → Redirect URLs (and Google JS origins). */
export const SUPABASE_AUTH_SITE_ORIGINS = [
  "http://localhost:3000",
  "https://www.studio-canvas-ai.com",
  "https://studio-canvas-ai.vercel.app",
] as const;

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/**
 * Normalize and validate NEXT_PUBLIC_SUPABASE_URL.
 * Fixes common paste mistakes (missing scheme, trailing slash, quotes, whitespace)
 * and rejects placeholder / malformed hosts that would cause DNS NXDOMAIN.
 */
export function normalizeSupabaseUrl(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  let value = stripWrappingQuotes(raw);
  if (!value) return undefined;

  // Accidental "URL=https://..." paste into the value field
  if (value.toLowerCase().startsWith("next_public_supabase_url=")) {
    value = value.slice("next_public_supabase_url=".length).trim();
  }

  // Paste of full Google/Supabase callback URL by mistake
  value = value.replace(/\/auth\/v1\/callback\/?$/i, "");

  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return undefined;
  }

  if (parsed.protocol !== "https:") {
    // Supabase Auth requires HTTPS in production; allow http only for local emulators.
    if (parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
      return undefined;
    }
  }

  const host = parsed.hostname.toLowerCase();
  const isLocal = host === "localhost" || host === "127.0.0.1";
  const isSupabaseHost =
    host.endsWith(".supabase.co") || host.endsWith(".supabase.in");

  if (!isLocal && !isSupabaseHost) {
    return undefined;
  }

  if (!isLocal) {
    const projectRef = host.split(".")[0] ?? "";
    // Hosted project refs are typically ~20 lowercase alphanumeric chars.
    if (
      projectRef.length < 15 ||
      PLACEHOLDER_HOST_FRAGMENTS.some((frag) => projectRef.includes(frag))
    ) {
      return undefined;
    }
    // Block retired test projects (wrong Kakao redirect_uri → KOE006).
    if (
      (RETIRED_SUPABASE_PROJECT_REFS as readonly string[]).includes(projectRef)
    ) {
      return undefined;
    }
  }

  // Canonical form: origin only (no path/query/hash, no trailing slash)
  return parsed.origin;
}

export function getSupabaseUrl(): string | undefined {
  return normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

/** IdP OAuth callback derived from env (`…/auth/v1/callback`). */
export function getSupabaseAuthCallbackUrl(): string | undefined {
  const base = getSupabaseUrl();
  return base ? `${base}/auth/v1/callback` : undefined;
}

export function getSupabaseAnonKey(): string | undefined {
  const key = stripWrappingQuotes(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      ""
  );
  if (!key) return undefined;
  // Legacy JWT anon keys (eyJ…) or new publishable keys (sb_publishable_…)
  const isJwt = key.startsWith("eyJ") && key.length >= 40;
  const isPublishable = key.startsWith("sb_publishable_") && key.length >= 24;
  if (!isJwt && !isPublishable && key.length < 20) return undefined;
  if (/^(your|xxx|replace|changeme)/i.test(key)) return undefined;
  return key;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

/**
 * Human-readable reason when Supabase env is present but invalid
 * (e.g. typo'd project ref that would NXDOMAIN).
 */
export function getSupabaseConfigError(): string | null {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!rawUrl?.trim() && !rawKey?.trim()) {
    return "Missing NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.";
  }
  if (!rawUrl?.trim()) {
    return "Missing NEXT_PUBLIC_SUPABASE_URL.";
  }
  if (!normalizeSupabaseUrl(rawUrl)) {
    const lower = (rawUrl || "").toLowerCase();
    if (
      (RETIRED_SUPABASE_PROJECT_REFS as readonly string[]).some((ref) =>
        lower.includes(ref)
      )
    ) {
      return (
        `NEXT_PUBLIC_SUPABASE_URL points at a retired test project. ` +
        `Use the canonical project ${CANONICAL_SUPABASE_URL} ` +
        `(callback ${CANONICAL_SUPABASE_AUTH_CALLBACK_URL}).`
      );
    }
    return (
      "NEXT_PUBLIC_SUPABASE_URL is invalid. Use the exact Project URL from " +
      `Supabase → Project Settings → API (${CANONICAL_SUPABASE_URL}). ` +
      "A typo causes DNS_PROBE_FINISHED_NXDOMAIN."
    );
  }
  if (!getSupabaseAnonKey()) {
    return "Missing or invalid NEXT_PUBLIC_SUPABASE_ANON_KEY (anon/publishable key).";
  }
  return null;
}

/** Site origin used for OAuth redirectTo allowlist entries. */
export function getAuthSiteOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.AUTH_URL?.replace(/\/$/, "") ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}
