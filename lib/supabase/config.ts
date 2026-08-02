/**
 * Supabase Auth env helpers.
 * OAuth Client ID/Secret live in the Supabase dashboard — the Next.js app only
 * needs the project URL + anon (publishable) key.
 */

const PLACEHOLDER_HOST_FRAGMENTS = [
  "your_project_ref",
  "your-project-ref",
  "project_ref",
  "xxxxxxxx",
  "example",
];

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
    if (
      projectRef.length < 10 ||
      PLACEHOLDER_HOST_FRAGMENTS.some((frag) => projectRef.includes(frag))
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
    return (
      "NEXT_PUBLIC_SUPABASE_URL is invalid. Use the exact Project URL from " +
      "Supabase → Project Settings → API (https://<project-ref>.supabase.co). " +
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
