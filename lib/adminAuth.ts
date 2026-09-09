import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { requireAuthSecret } from "@/lib/authSecret";
import { useSecureAuthCookies } from "@/lib/authCookies";
import { PRIVILEGED_ADMIN_EMAILS } from "@/lib/unlimitedAccount";

export const ADMIN_SESSION_COOKIE = "sca_admin_session";
/** Admin portal session lifetime (12 hours). */
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 12;

export type AdminSession = {
  user: { email: string; name: string | null };
  authProvider: "admin";
};

function adminEmails(): string[] {
  const fromEnv = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  // Hardcoded privileged admins always count (even if Vercel env is stale).
  return Array.from(
    new Set([
      ...fromEnv,
      ...PRIVILEGED_ADMIN_EMAILS.map((e) => e.toLowerCase()),
    ])
  );
}

/** Shared secret for the dedicated admin login form (password or token). */
export function getAdminSecret(): string {
  return (
    process.env.ADMIN_PASSWORD?.trim() ||
    process.env.ADMIN_TOKEN?.trim() ||
    ""
  );
}

export function isAdminEmail(email: string): boolean {
  return adminEmails().includes(email.trim().toLowerCase());
}

function hmacKey(): string {
  return `${requireAuthSecret()}::admin::${getAdminSecret() || "unset"}`;
}

function sign(body: string): string {
  return createHmac("sha256", hmacKey()).update(body).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

export function createAdminSessionToken(email: string): string {
  const payload = {
    email: email.trim().toLowerCase(),
    exp: Date.now() + ADMIN_SESSION_MAX_AGE * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyAdminSessionToken(
  token: string | undefined | null
): { email: string } | null {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if (!safeEqual(sign(body), sig)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as { email?: string; exp?: number };
    if (!parsed.email || typeof parsed.exp !== "number") return null;
    if (parsed.exp < Date.now()) return null;
    if (!isAdminEmail(parsed.email)) return null;
    return { email: parsed.email };
  } catch {
    return null;
  }
}

export function adminCookieOptions(maxAge = ADMIN_SESSION_MAX_AGE) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: useSecureAuthCookies(),
    maxAge,
  };
}

function safeEqualString(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/**
 * Validate dedicated admin credentials (not the public user Auth.js session).
 */
export function validateAdminCredentials(
  email: string,
  password: string
): { ok: true; email: string } | { ok: false; error: string } {
  const normalized = email.trim().toLowerCase();
  const secret = getAdminSecret();
  if (!secret) {
    return {
      ok: false,
      error: "Admin login is not configured (set ADMIN_PASSWORD).",
    };
  }
  if (!normalized || !isAdminEmail(normalized) || !safeEqualString(password, secret)) {
    return { ok: false, error: "Invalid admin email or password." };
  }
  return { ok: true, email: normalized };
}

/**
 * Resolve the dedicated admin cookie session for /admin and /api/admin/*.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  try {
    const jar = await cookies();
    const token = jar.get(ADMIN_SESSION_COOKIE)?.value;
    const verified = verifyAdminSessionToken(token);
    if (!verified) return null;
    return {
      user: { email: verified.email, name: "Admin" },
      authProvider: "admin",
    };
  } catch {
    return null;
  }
}

/**
 * Admin access for Template 04 / Space 4 APIs used from Screen 26.
 * Accepts either the dedicated /admin cookie OR a logged-in user whose
 * email is on the admin allow-list (matches CreditsProvider `isAdmin`).
 */
export async function resolveAdminAccess(
  req: Request
): Promise<AdminSession | null> {
  const cookieSession = await getAdminSession();
  if (cookieSession) return cookieSession;

  try {
    const { resolveAppUser } = await import("@/lib/resolveAppUser");
    const resolved = await resolveAppUser(req);
    if (!resolved.ok) return null;
    const email = (resolved.user.email || "").trim().toLowerCase();
    if (!email || !isAdminEmail(email)) return null;
    return {
      user: { email, name: resolved.user.name ?? "Admin" },
      authProvider: "admin",
    };
  } catch {
    return null;
  }
}

export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("ADMIN_FORBIDDEN");
  return session;
}
